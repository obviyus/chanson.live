import { io } from "./index";
import { defaultWorker } from "./mediasoupHandler";

export function SocketHandler() {
    io.on("connection", (socket) => {
        console.log(`Client connected: ${ socket.id }; Total clients: ${ io.engine.clientsCount }`);
        io.sockets.emit("clientCount", {
            clientCount: io.engine.clientsCount,
        });

        /**
         * Handle client disconnection.
         */
        socket.on("disconnect", () => {
                console.log(`Client disconnected: ${ socket.id }; Total clients: ${ io.engine.clientsCount }`);
                io.sockets.emit("clientCount", {
                    clientCount: io.engine.clientsCount,
                });
            }
        );

        /**
         * Log socket errors.
         */
        socket.on("error", (error) => {
            console.error(`Error on socket: ${ socket.id }: ${ error }`);
        });
        socket.on("connect_error", (error) => {
            console.error(`Client connection error on socket: ${ socket.id }: ${ error }`);
        });

        /**
         * Handle getRouterRtpCapabilities request.
         */
        socket.on("getRouterRtpCapabilities", (_data, callback) => {
            console.log(`Received getRouterRtpCapabilities request from client: ${ socket.id }`);

            if (defaultWorker.router.rtpCapabilities) {
                callback(defaultWorker.router.rtpCapabilities);
            } else {
                callback(null);
            }
        });

        /**
         * Handle createConsumerTransport request.
         */
        socket.on("createConsumerTransport", async (_data, callback) => {
            console.log(`Received createConsumerTransport request from client: ${ socket.id }`);

            const consumerTransport = await defaultWorker.createWebRTCTransport(socket.id);

            consumerTransport.observer.on("close", () => {
                console.log(`Consumer transport closed: ${ consumerTransport.id }`);

                delete defaultWorker.transports[consumerTransport.id];
                delete defaultWorker.consumers[consumerTransport.id];
            });

            callback({
                id: consumerTransport.id,
                iceParameters: consumerTransport.iceParameters,
                iceCandidates: consumerTransport.iceCandidates,
                dtlsParameters: consumerTransport.dtlsParameters,
            });

            socket.emit("metadata", defaultWorker.currentSongMetadata);
        });

        /**
         * Handle connectConsumerTransport request.
         */
        socket.on("connectConsumerTransport", async (data, callback) => {
            console.log(`Received connectConsumerTransport request from client: ${ socket.id }`);

            const consumerTransport = defaultWorker.transports[socket.id];
            if (consumerTransport) {
                await consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
                callback({});
            } else {
                callback(null);
                console.error(`Consumer transport not found: ${ socket.id }`);
            }
        });

        /**
         * Handle consume request.
         */
        socket.on("consume", async (data, callback) => {
            const producer = defaultWorker.producer;
            if (!producer) {
                console.error(`No producers ready to consume`);
                callback(null);
                return;
            }

            const consumerTransport = defaultWorker.transports[socket.id];
            if (!consumerTransport) {
                console.error(`Consumer transport not found: ${ socket.id }`);
                return;
            }

            const consumer = await defaultWorker.createConsumer(
                consumerTransport,
                data.rtpCapabilities
            );

            if (consumer !== null) {
                callback({
                    id: consumer.id,
                    producerId: consumer.producerId,
                    rtpParameters: consumer.rtpParameters,
                    producerPaused: false,
                });
            }


        });

        /**
         * Emit a welcome message to complete the connection.
         */
        socket.emit("message", {
            type: "welcome",
            id: socket.id
        });
    });
}
