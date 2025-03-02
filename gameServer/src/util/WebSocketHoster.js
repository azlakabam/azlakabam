const INITIAL_ACCEPT_BACKOFF_DELAY = 5;

let didRegisterUnhandledRejection = false;
/**
 * Registers an event listener for the "unhandledrejection" event.
 * If an unhandled rejection appears that is known to be commonly triggered
 * by websocket connections, the event is `preventDefault`ed in order to not
 * shut the server down.
 */
export function registerUnhandledRejection() {
	if (didRegisterUnhandledRejection) return;
	globalThis.addEventListener("unhandledrejection", (e) => {
		let suppressError = false;
		if (e.reason instanceof Error) {
			if (e.reason.message.includes("Broken pipe")) {
				suppressError = true;
			}
			if (e.reason.message.includes("Connection reset by peer")) {
				suppressError = true;
			}
		}

		if (!suppressError) {
			console.error("catched in unhandledrejection", e.reason);
			if (e.reason instanceof Error) {
				console.error(e.reason.stack);
			}
		}
		e.preventDefault();
	});
	didRegisterUnhandledRejection = true;
}

/**
 * Basic wrapper around the Deno apis used for hosting a websocket.
 * This takes care of all of the error handling in case of network errors.
 */
export class WebSocketHoster {
	#onConnectionCb;
	#overrideRequestHandler;
	#acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;

	/**
	 * @param {(socket: WebSocket, ip: string) => void} onConnection A callback that fires when a new connection
	 * is opened. The websocket passed as argument is guaranteed to be open.
	 * @param {Object} options
	 * @param {(req: Request) => Promise<Response?>} [options.overrideRequestHandler] A callback that allows you to override requests. When the callback
	 * returns a value it will be used as response instead of creating a new connection to the websocket.
	 * For more complex situations you should probably use "std/http/mod.ts" instead of this.
	 */
	constructor(onConnection, { overrideRequestHandler } = {}) {
		this.#onConnectionCb = onConnection;
		this.#overrideRequestHandler = overrideRequestHandler;
	}

	/**
	 * @param {number} port
	 * @param {string} hostname
	 */
	startServer(port, hostname) {
		registerUnhandledRejection();
		Deno.serve({ port, hostname }, this.handleRequest);
	}

	/**
	 * @param {Request} request
	 * @param {Deno.ServeHandlerInfo<Deno.NetAddr>} info
	 */
	async handleRequest(request, info) {
		const remoteAddr = info.remoteAddr;
		if (this.#overrideRequestHandler) {
			const response = await this.#overrideRequestHandler(request);
			if (response) return response;
		}
		if (request.method != "GET") {
			return new Response("Endpoint is a websocket", {
				status: 405,
			});
		}
		if (request.headers.get("upgrade") != "websocket") {
			return new Response("Endpoint is a websocket", {
				status: 426,
				headers: {
					upgrade: "websocket",
				},
			});
		}
		let ip = "";
		const realIp = request.headers.get("X-Real-IP");
		if (realIp) {
			ip = realIp;
		} else if (remoteAddr.transport == "tcp") {
			ip = remoteAddr.hostname;
		}
		const { socket, response } = Deno.upgradeWebSocket(request);
		socket.addEventListener("open", (_) => {
			this.#onConnectionCb(socket, ip);
		});
		return response;
	}
}
