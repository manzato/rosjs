/*
 *    Copyright 2016 Rethink Robotics
 *
 *    Copyright 2016 Chris Smith
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NetworkUtils = require('../utils/network_utils.js');
var SerializationUtils = require('../utils/serialization_utils.js');
var DeserializeStream = SerializationUtils.DeserializeStream;
var Deserialize = SerializationUtils.Deserialize;
var Serialize = SerializationUtils.Serialize;
var TcprosUtils = require('../utils/tcpros_utils.js');
var Socket = require('net').Socket;
var EventEmitter = require('events');
var Logging = require('./Logging.js');

var _require = require('../utils/ClientStates.js'),
    REGISTERING = _require.REGISTERING,
    REGISTERED = _require.REGISTERED,
    SHUTDOWN = _require.SHUTDOWN;

var protocols = [['TCPROS']];

//-----------------------------------------------------------------------

var Subscriber = function (_EventEmitter) {
  _inherits(Subscriber, _EventEmitter);

  function Subscriber(options, nodeHandle) {
    _classCallCheck(this, Subscriber);

    var _this = _possibleConstructorReturn(this, (Subscriber.__proto__ || Object.getPrototypeOf(Subscriber)).call(this));

    _this._topic = options.topic;

    _this._type = options.type;

    if (options.queueSize) {
      _this._queueSize = options.queueSize;
    } else {
      _this._queueSize = 1;
    }

    /**
     * throttleMs interacts with queueSize to determine when to handle callbacks
     *  < 0  : handle immediately - no interaction with queue
     *  >= 0 : place event at end of event queue to handle after minimum delay (MS)
     */
    if (options.hasOwnProperty('throttleMs')) {
      _this._throttleMs = options.throttleMs;
    } else {
      _this._throttleMs = 0;
    }

    _this._msgHandleTime = null;

    _this._nodeHandle = nodeHandle;
    _this._nodeHandle.getSpinner().addClient(_this, _this._getSpinnerId(), _this._queueSize, _this._throttleMs);

    _this._log = Logging.getLogger('ros.rosnodejs');

    _this._messageHandler = options.typeClass;

    _this._pubClients = {};

    _this._state = REGISTERING;
    _this._register();
    return _this;
  }

  _createClass(Subscriber, [{
    key: '_getSpinnerId',
    value: function _getSpinnerId() {
      return 'Subscriber://' + this.getTopic();
    }
  }, {
    key: 'getTopic',
    value: function getTopic() {
      return this._topic;
    }
  }, {
    key: 'getType',
    value: function getType() {
      return this._type;
    }
  }, {
    key: 'getNumPublishers',
    value: function getNumPublishers() {
      return Object.keys(this._pubClients).length;
    }
  }, {
    key: 'shutdown',
    value: function shutdown() {
      this._log.debug('Shutting down subscriber %s', this.getTopic());
      this._nodeHandle.unsubscribe(this.getTopic());
    }
  }, {
    key: 'isShutdown',
    value: function isShutdown() {
      return this._state === SHUTDOWN;
    }

    /**
     * Send a topic request to each of the publishers we haven't connected to yet
     * @param pubs {Array} array of uris of nodes that are publishing this topic
     */

  }, {
    key: 'requestTopicFromPubs',
    value: function requestTopicFromPubs(pubs) {
      var _this2 = this;

      pubs.forEach(function (pubUri) {
        pubUri = pubUri.trim();
        _this2._requestTopicFromPublisher(pubUri);
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      this._state = SHUTDOWN;

      Object.keys(this._pubClients).forEach(this._disconnectClient.bind(this));

      // disconnect from the spinner in case we have any pending callbacks
      this._nodeHandle.getSpinner().disconnect(this._getSpinnerId());
      this._pubClients = {};
    }

    /**
     * Handle an update from the ROS master with the list of current publishers. Connect to any new ones
     * and disconnect from any not included in the list.
     * @param publisherList [Array.string]
     * @private
     */

  }, {
    key: '_handlePublisherUpdate',
    value: function _handlePublisherUpdate(publisherList) {
      var _this3 = this;

      var missingPublishers = new Set(Object.keys(this._pubClients));

      publisherList.forEach(function (pubUri) {
        pubUri = pubUri.trim();
        if (!_this3._pubClients.hasOwnProperty(pubUri)) {
          _this3._requestTopicFromPublisher(pubUri);
        }

        missingPublishers.delete(pubUri);
      });

      missingPublishers.forEach(function (pubUri) {
        _this3._disconnectClient(pubUri);
      });
    }
  }, {
    key: '_requestTopicFromPublisher',
    value: function _requestTopicFromPublisher(pubUri) {
      var _this4 = this;

      var info = NetworkUtils.getAddressAndPortFromUri(pubUri);
      // send a topic request to the publisher's node
      this._log.debug('Sending topic request to ' + JSON.stringify(info));
      this._nodeHandle.requestTopic(info.host, info.port, this._topic, protocols).then(function (resp) {
        _this4._handleTopicRequestResponse(resp, pubUri);
      }).catch(function (err, resp) {
        // there was an error in the topic request
        _this4._log.warn('Error requesting topic on %s: %s, %s', _this4.getTopic(), err, resp);
      });
    }
  }, {
    key: '_disconnectClient',
    value: function _disconnectClient(clientId) {
      var client = this._pubClients[clientId];
      this._log.debug('Disconnecting client %s', clientId);
      client.end();

      client.$deserializer.removeAllListeners();

      client.$deserializer.end();
      client.unpipe(client.$deserializer);

      delete client.$deserializer;
      delete client.$boundMessageHandler;

      delete this._pubClients[clientId];
    }
  }, {
    key: '_register',
    value: function _register() {
      var _this5 = this;

      this._nodeHandle.registerSubscriber(this._topic, this._type).then(function (resp) {
        // if we were shutdown between the starting the registration and now, bail
        if (_this5.isShutdown()) {
          return;
        }

        // else handle response from register subscriber call
        var code = resp[0];
        var msg = resp[1];
        var pubs = resp[2];
        if (code === 1) {
          // success! update state to reflect that we're registered
          _this5._state = REGISTERED;

          if (pubs.length > 0) {
            // this means we're ok and that publishers already exist on this topic
            // we should connect to them
            _this5.requestTopicFromPubs(pubs);
          }
          _this5.emit('registered');
        }
      }).catch(function (err, resp) {
        _this5._log.warn('Error during subscriber %s registration: %s', _this5.getTopic(), err);
      });
    }

    /**
     * @param resp {Array} xmlrpc response to a topic request
     */

  }, {
    key: '_handleTopicRequestResponse',
    value: function _handleTopicRequestResponse(resp, nodeUri) {
      var _this6 = this;

      if (this.isShutdown()) {
        return;
      }

      this._log.debug('Topic request response: ' + JSON.stringify(resp));
      var info = resp[2];
      var port = info[2];
      var address = info[1];
      var client = new Socket();
      client.name = address + ':' + port;
      client.nodeUri = nodeUri;

      client.on('end', function () {
        _this6._log.info('Pub %s sent END', client.name, _this6.getTopic());
      });
      client.on('error', function () {
        _this6._log.warn('Pub %s error on topic %s', client.name, _this6.getTopic());
      });

      client.connect(port, address, function () {
        if (_this6.isShutdown()) {
          client.end();
          return;
        }

        _this6._log.debug('Subscriber on ' + _this6.getTopic() + ' connected to publisher at ' + address + ':' + port);
        client.write(_this6._createTcprosHandshake());

        _this6._pubClients[client.nodeUri] = client;
      });

      var deserializer = new DeserializeStream();

      client.$boundMessageHandler = this._handleMessage.bind(this, client);
      client.$deserializer = deserializer;

      client.pipe(deserializer);
      deserializer.on('message', client.$boundMessageHandler);
    }
  }, {
    key: '_createTcprosHandshake',
    value: function _createTcprosHandshake() {
      return TcprosUtils.createSubHeader(this._nodeHandle.getNodeName(), this._messageHandler.md5sum(), this.getTopic(), this.getType());
    }
  }, {
    key: '_handleMessage',
    value: function _handleMessage(client, msg) {
      var _this7 = this;

      if (!client.$initialized) {

        var header = TcprosUtils.parseTcpRosHeader(msg);
        // check if the publisher had a problem with our connection header
        if (header.error) {
          this._log.error(header.error);
          return;
        }

        // else validate publisher's header
        var error = TcprosUtils.validatePubHeader(header, this.getType(), this._messageHandler.md5sum());
        if (error) {
          this._log.error('Unable to validate subscriber ' + this.getTopic() + ' connection header ' + JSON.stringify(header));
          TcprosUtils.parsePubHeader(msg);
          client.end(Serialize(error));
          return;
        }

        this._log.debug('Subscriber ' + this.getTopic() + ' got connection header ' + JSON.stringify(header));
        client.$initialized = true;

        this.emit('connection', header, client.name);

        client.on('close', function () {
          _this7._log.info('Pub %s closed on topic %s', client.name, _this7.getTopic());
          _this7._log.debug('Subscriber ' + _this7.getTopic() + ' client ' + client.name + ' disconnected!');
          delete _this7._pubClients[client.nodeUri];

          _this7.emit('disconnect');
        });
      } else {
        if (this._throttleMs < 0) {
          this._handleMsgQueue([msg]);
        } else {
          this._nodeHandle.getSpinner().ping(this._getSpinnerId(), msg);
        }
      }
    }
  }, {
    key: '_handleMsgQueue',
    value: function _handleMsgQueue(msgQueue) {
      var _this8 = this;

      msgQueue.forEach(function (msg) {
        try {
          _this8.emit('message', _this8._messageHandler.deserialize(msg));
        } catch (err) {
          _this8._log.warn('Error while dispatching message ' + err);
        }
      });
    }
  }]);

  return Subscriber;
}(EventEmitter);

//-----------------------------------------------------------------------

module.exports = Subscriber;