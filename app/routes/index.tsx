import React, { createRef, useEffect, useState } from "react";
import type { Consumer } from "mediasoup-client/lib/Consumer";
import type { Transport } from "mediasoup-client/lib/Transport";
import { Device } from "mediasoup-client";
import { socket } from "~/utils/socket";
import Logo from '../../public/logo.png'

export default function Index() {
    /**
     * Each property we need gets its own state variable.
     * TODO: Improve state management (maybe Redux?).
     */
    const [consumerTransport, setConsumerTransport] = useState<Transport>();
    const [consumer, setConsumer] = useState<Consumer>();
    const [device, setDevice] = useState<Device>();
    const [producerID, setProducerID] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>();
    const [clientCount, setClientCount] = useState<number>(0);

    const audio = createRef<HTMLAudioElement>();

    /**
     * Emitter for sending data back to the server.
     * @param type
     * @param data
     */
    function socketEmit(type: string, data: any) {
        return new Promise((resolve, reject) => {
            socket.emit(type, data, (response: any, err: any) => {
                if (!err) {
                    resolve(response);
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
     * Create/Update a consumer when a new producer is created.
     */
    function createConsumer() {
        if (consumerTransport && device) {
            console.log(`STARTING_CONSUMER_FOR_TRANSPORT: ${ consumerTransport.id }`);
            const { rtpCapabilities } = device;

            socketEmit("consume", { rtpCapabilities }).then((response: any) => {
                if (response === null) {
                    console.log("NO_PRODUCERS_AVAILABLE");
                } else {
                    console.log(`CONSUMING_PRODUCER: ${ response['producerId'] }`);

                    consumerTransport.consume({
                        producerId: response['producerId'],
                        id: response['id'],
                        kind: "audio",
                        rtpParameters: response['rtpParameters'],
                    }).then((consumer: Consumer) => {
                        setConsumer(consumer);
                    });
                }
            });
        }
    }

    /**
     * Load a device from the client.
     * @param routerRtpCapabilities
     */
    async function loadDevice(routerRtpCapabilities: any): Promise<Device> {
        try {
            const newDevice = new Device();
            await newDevice.load({ routerRtpCapabilities });

            return newDevice;
        } catch (error: any) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }

            throw error;
        }
    }

    function connectSocket() {
        socket.on("connect", () => {
            console.log("SOCKET_CONNECTED");
        });

        socket.on("clientCount", (message: Record<string, string>) => {
            console.log(`CLIENT_COUNT: ${ message['clientCount'] }`);
            setClientCount(parseInt(message['clientCount']));
        });

        socket.on('error', function (err) {
            console.log(`SOCKET_ERROR: ${ err }`);
        });

        socket.on('disconnect', function (evt) {
            console.log(`SOCKET_DISCONNECT: ${ evt }`);
        });

        socket.on("message", (message: Record<string, string>) => {
            if (message['type'] === 'welcome') {
                if (socket.id !== message['id']) {
                    console.log(`SOCKET_WARN ID_MISMATCH: ${ message['id'] } != ${ socket.id }`);
                }

                console.log(`SOCKET_WELCOME: ${ message['id'] }`);
            }
        });

        socket.on("producerStarted", function (message: Record<string, string>) {
            console.log(`SOCKET_NEW_PRODUCER_STARTED: ${ message['id'] }`);
            setProducerID(message['id']);
        });

        socket.on("producerClosed", async function (message: Record<string, string>) {
            console.log(`SOCKET_PRODUCER_CLOSED: ${ message['id'] }`);
            setProducerID(null);

            if (consumer) {
                consumer.close();
            }

            if (audio.current) {
                audio.current.srcObject = null;
            }
        });

        socket.on("metadata", (message: Record<string, string>) => {
            console.log(`SOCKET_METADATA: ${ message }`);
            setMetadata(message);
        });

        /**
         * Get Router RTP Capabilities.
         */
        socketEmit('getRouterRtpCapabilities', {}).then((routerRtpCapabilities: any) => {
            console.log(`SOCKET_GET_ROUTER_RTP_CAPABILITIES: ${ routerRtpCapabilities }`);
            loadDevice(routerRtpCapabilities).then((newDevice: Device) => {
                setDevice(newDevice);
            });
        });
    }

    /**
     * Make a socket connection once the page loads.
     */
    useEffect(() => {
        if (!socket.connected) {
            connectSocket();
        }
    }, []);

    /**
     * Create a consumer transport after the client device is loaded.
     */
    useEffect(() => {
        socketEmit('createConsumerTransport', {}).then((response: any) => {
            if (device) {
                console.log(`DEVICE_LOADED: ${ device.loaded }`)
                setConsumerTransport(device.createRecvTransport(response));
            }
        });
    }, [device]);

    /**
     * Create a consumer when the consumerTransport is created.
     */
    useEffect(() => {
        if (consumerTransport) {
            console.log(`CONSUMER_TRANSPORT_CREATED: ${ consumerTransport.id }`);

            consumerTransport.on('connect', async ({ dtlsParameters }, callback) => {
                socketEmit('connectConsumerTransport', { dtlsParameters }).then(callback);
            });

            consumerTransport.on('connectionstatechange', (state) => {
                switch (state) {
                    case 'connecting':
                        console.log('SUBSCRIBER_CONNECTING');
                        break;
                    case 'connected':
                        console.log('SUBSCRIBER_CONNECTED');
                        break;
                    case 'failed':
                        console.log('SUBSCRIBER_FAILED');
                        break;
                    default:
                        break;
                }
            });

            createConsumer();
        }
    }, [consumerTransport]);

    /**
     * Add the audio stream to the page once the consumer is created.
     */
    useEffect(() => {
        if (consumer) {
            console.log(`CONSUMER_CREATED: ${ consumer.id }`);

            const stream = new MediaStream();
            stream.addTrack(consumer.track);

            if (audio.current) {
                audio.current.srcObject = stream;
                audio.current.play();
            }
        }
    }, [consumer]);

    /**
     * Create a consumer when the producerID is set.
     */
    useEffect(() => {
        if (producerID !== null) {
            console.log(`PRODUCER_CREATED: ${ producerID }`);
            console.log(`TRANSPORT: ${ consumerTransport?.id }`);
            console.log(`DEVICE: ${ device?.loaded }`);
            createConsumer();
        }
    }, [producerID]);

    return (
        <div
            className={ 'flex mx-auto max-w-screen-sm p-2 items-center flex-col pb-16 pt-12 min-h-screen' }>

            <img src={ Logo }
                 alt={ 'logo' }
                 className={ 'w-32 h-32 mb-4 rounded-xl' }/>

            <h1
                className={ 'text-center text-2xl font-bold' }>Mach Radio 📻
            </h1>

            <p>
                { clientCount } listener(s)
            </p>

            <img src={ metadata && metadata.cover }
                 alt={ metadata && metadata.title }
                 className={ 'max-w-sm aspect-square pt-10 px-5' }
            />

            <h2 className={ 'pt-10 text-center font-bold tracking-wide' }>
                { metadata && metadata.title }
            </h2>

            <h2 className={ 'pt-2 text-center font-semibold tracking-wide' }>
                { metadata && metadata.artist }
            </h2>

            <p className={ 'pt-2 text-center' }>
                { metadata && metadata.album }
            </p>

            <audio ref={ audio }
                   controls={ true }
                   autoPlay
                   preload={ 'auto' }
                   className={ 'mt-10' }
            />
        </div>
    );
}
