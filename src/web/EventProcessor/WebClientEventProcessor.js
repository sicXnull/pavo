/**
 * @file
 * @version 0.1
 * @copyright 2018 CN-Consult GmbH
 * @author Yannick Lapp <yannick.lapp@cn-consult.eu>
 */

const BaseEventProcessor = require(__dirname + "/BaseEventProcessor");

/**
 * Parent class for event processors.
 * Event processors can handle a specified list of socket events.
 */
class WebClientEventProcessor extends BaseEventProcessor
{
    /**
     * BaseEventProcessor constructor.
     *
     * @param {Server} _socket The socket
     * @param {PavoApi} _pavoApi The pavo api
     * @param {String[]} _eventNames
     */
    constructor(_socket, _pavoApi, _eventNames)
    {
        super(_socket, _pavoApi);
        this.eventNames = _eventNames;
    }


    // Public Methods

    /**
     * Adds the event listener of this event processor to a socket.
     *
     * @param {Server} _socket The client socket that connected to the server
     */
    initializeEventListeners(_socket)
    {
        this.initializeEventListenersFor(_socket, this.eventNames);
    }

    /**
     * Processes one of the events that this event processor listens to.
     *
     * @param {Server} _socket The socket that emitted the event
     * @param {String} _eventName The name of the event
     * @param {*} _data The data that was sent with the event
     */
    processEvent(_socket, _eventName, _data)
    {
        this.processWebClientEvent(_eventName, _data);
    }

    /**
     * Processes a web client event.
     *
     * @param {String} _eventName The name of the event
     * @param {*} _data The data that was sent with the event
     */
    processWebClientEvent(_eventName, _data)
    {
    }
}

/**
 * The list of event names to which this event processor listens
 *
 * @type {String[]} eventNames
 */
WebClientEventProcessor.eventNames = [];


module.exports = WebClientEventProcessor;
