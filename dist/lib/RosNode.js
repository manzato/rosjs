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

var net = require('net');
var xmlrpc = require('xmlrpc');
var MasterApiClient = require('./MasterApiClient.js');
var SlaveApiClient = require('./SlaveApiClient.js');
var ParamServerApiClient = require('./ParamServerApiClient.js');
var Subscriber = require('./Subscriber.js');
var Publisher = require('./Publisher.js');
var ServiceClient = require('./ServiceClient.js');
var ServiceServer = require('./ServiceServer.js');
var Spinner = require('../utils/GlobalSpinner.js');
var NetworkUtils = require('../utils/network_utils.js');
var messageUtils = require('../utils/message_utils.js');
var tcprosUtils = require('../utils/tcpros_utils.js');
var SerializationUtils = require('../utils/serialization_utils.js');
var DeserializeStream = SerializationUtils.DeserializeStream;
var Deserialize = SerializationUtils.Deserialize;
var Serialize = SerializationUtils.Serialize;
var EventEmitter = require('events');
var Logging = require('./Logging.js');

/**
 * Create a ros node interface to the master
 * @param name {string} name of the node
 * @param rosMaster {string} full uri of ros maxter (http://localhost:11311)
 */

var RosNode = function (_EventEmitter) {
  _inherits(RosNode, _EventEmitter);

  function RosNode(nodeName, rosMaster) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    _classCallCheck(this, RosNode);

    var _this = _possibleConstructorReturn(this, (RosNode.__proto__ || Object.getPrototypeOf(RosNode)).call(this));

    _this._log = Logging.getLogger('ros.rosnodejs');
    _this._debugLog = Logging.getLogger('ros.superdebug');

    _this._slaveApiServer = null;
    _this._xmlrpcPort = null;

    _this._tcprosServer = null;
    _this._tcprosPort = null;

    _this._nodeName = nodeName;

    _this._rosMasterAddress = rosMaster;

    _this._masterApi = new MasterApiClient(_this._rosMasterAddress);

    // the param server is hosted on the master -- share its xmlrpc client
    _this._paramServerApi = new ParamServerApiClient(_this._masterApi.getXmlrpcClient());

    _this._publishers = {};

    _this._subscribers = {};

    _this._services = {};

    _this._setupTcprosServer(options.tcprosPort).then(_this._setupSlaveApi.bind(_this, options.xmlrpcPort));

    _this._setupExitHandler();

    _this._spinner = new Spinner();
    return _this;
  }

  _createClass(RosNode, [{
    key: 'getLogger',
    value: function getLogger() {
      return this._log;
    }
  }, {
    key: 'getSpinner',
    value: function getSpinner() {
      return this._spinner;
    }
  }, {
    key: 'getRosMasterUri',
    value: function getRosMasterUri() {
      return this._rosMasterAddress;
    }
  }, {
    key: 'advertise',
    value: function advertise(options) {
      var topic = options.topic;
      var pub = this._publishers[topic];
      if (!pub) {
        pub = new Publisher(options, this);
        this._publishers[topic] = pub;
      }
      return pub;
    }
  }, {
    key: 'subscribe',
    value: function subscribe(options, callback) {
      var topic = options.topic;
      var sub = this._subscribers[topic];
      if (!sub) {
        sub = new Subscriber(options, this);
        this._subscribers[topic] = sub;
      }

      if (callback && typeof callback === 'function') {
        sub.on('message', callback);
      }

      return sub;
    }
  }, {
    key: 'advertiseService',
    value: function advertiseService(options, callback) {
      var service = options.service;
      var serv = this._services[service];
      if (!serv) {
        serv = new ServiceServer(options, callback, this);
        this._services[service] = serv;
      }
      return serv;
    }
  }, {
    key: 'serviceClient',
    value: function serviceClient(options) {
      return new ServiceClient(options, this);
    }
  }, {
    key: 'unsubscribe',
    value: function unsubscribe(topic) {
      var sub = this._subscribers[topic];
      if (sub) {
        this._debugLog.info('Unsubscribing from topic %s', topic);
        sub.disconnect();
        this.unregisterSubscriber(topic);
        delete this._subscribers[topic];
      }
    }
  }, {
    key: 'unadvertise',
    value: function unadvertise(topic) {
      var pub = this._publishers[topic];
      if (pub) {
        this._debugLog.info('Unadvertising topic %s', topic);
        pub.disconnect();
        this.unregisterPublisher(topic);
        delete this._publishers[topic];
      }
    }
  }, {
    key: 'unadvertiseService',
    value: function unadvertiseService(service) {
      var server = this._services[service];
      if (server) {
        this._debugLog.info('Unadvertising service %s', service);
        server.disconnect();
        this.unregisterService(service, server.getServiceUri());
        delete this._services[service];
      }
    }
  }, {
    key: 'getNodeName',
    value: function getNodeName() {
      return this._nodeName;
    }

    //------------------------------------------------------------------
    // Master API
    //------------------------------------------------------------------

  }, {
    key: 'registerService',
    value: function registerService(service) {
      var _this2 = this;

      return this._whenReady().then(function () {
        return _this2._masterApi.registerService(_this2._nodeName, service, NetworkUtils.formatServiceUri(_this2._tcprosPort), _this2._getXmlrpcUri());
      });
    }
  }, {
    key: 'unregisterService',
    value: function unregisterService(service) {
      var _this3 = this;

      return this._whenReady().then(function () {
        return _this3._masterApi.unregisterService(_this3._nodeName, service, NetworkUtils.formatServiceUri(_this3._tcprosPort));
      });
    }
  }, {
    key: 'registerSubscriber',
    value: function registerSubscriber(topic, topicType) {
      var _this4 = this;

      return this._whenReady().then(function () {
        return _this4._masterApi.registerSubscriber(_this4._nodeName, topic, topicType, _this4._getXmlrpcUri());
      });
    }
  }, {
    key: 'unregisterSubscriber',
    value: function unregisterSubscriber(topic) {
      var _this5 = this;

      return this._whenReady().then(function () {
        return _this5._masterApi.unregisterSubscriber(_this5._nodeName, topic, _this5._getXmlrpcUri());
      });
    }
  }, {
    key: 'registerPublisher',
    value: function registerPublisher(topic, topicType) {
      var _this6 = this;

      return this._whenReady().then(function () {
        return _this6._masterApi.registerPublisher(_this6._nodeName, topic, topicType, _this6._getXmlrpcUri());
      });
    }
  }, {
    key: 'unregisterPublisher',
    value: function unregisterPublisher(topic) {
      var _this7 = this;

      return this._whenReady().then(function () {
        return _this7._masterApi.unregisterPublisher(_this7._nodeName, topic, _this7._getXmlrpcUri());
      });
    }
  }, {
    key: 'lookupNode',
    value: function lookupNode(nodeName) {
      return this._masterApi.lookupNode(this._nodeName, nodeName);
    }
  }, {
    key: 'lookupService',
    value: function lookupService(service) {
      return this._masterApi.lookupService(this._nodeName, service);
    }
  }, {
    key: 'getMasterUri',
    value: function getMasterUri() {
      return this._masterApi.getUri(this._nodeName);
    }

    /**
     * Delays xmlrpc calls until our servers are set up
     * Since we need their ports for most of our calls.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_whenReady',
    value: function _whenReady() {
      var _this8 = this;

      if (this.slaveApiSetupComplete()) {
        return Promise.resolve();
      } else {
        return new Promise(function (resolve, reject) {
          _this8.on('slaveApiSetupComplete', function () {
            resolve();
          });
        });
      }
    }
  }, {
    key: '_getXmlrpcUri',
    value: function _getXmlrpcUri() {
      // TODO: get host or ip or ...
      return 'http://' + NetworkUtils.getHost() + ':' + this._xmlrpcPort;
    }

    //------------------------------------------------------------------
    // Parameter Server API
    //------------------------------------------------------------------

  }, {
    key: 'deleteParam',
    value: function deleteParam(key) {
      return this._paramServerApi.deleteParam(this._nodeName, key);
    }
  }, {
    key: 'setParam',
    value: function setParam(key, value) {
      return this._paramServerApi.setParam(this._nodeName, key, value);
    }
  }, {
    key: 'getParam',
    value: function getParam(key) {
      return this._paramServerApi.getParam(this._nodeName, key);
    }
  }, {
    key: 'hasParam',
    value: function hasParam(key) {
      return this._paramServerApi.hasParam(this._nodeName, key);
    }
    //------------------------------------------------------------------
    // Slave API
    //------------------------------------------------------------------

    /**
     * Send a topic request to another ros node
     * @param remoteAddress {string} ip address/hostname of node
     * @param remotePort {number} port of node
     * @param topic {string} topic we want a connection for
     * @param protocols {object} communication protocols this node supports (just TCPROS, really)
     */

  }, {
    key: 'requestTopic',
    value: function requestTopic(remoteAddress, remotePort, topic, protocols) {
      // every time we request a topic, it could be from a new node
      // so we create an xmlrpc client here instead of having a single one
      // for this object, like we do with the MasterApiClient
      var slaveApi = new SlaveApiClient(remoteAddress, remotePort);
      return slaveApi.requestTopic(this._nodeName, topic, protocols);
    }
  }, {
    key: 'slaveApiSetupComplete',
    value: function slaveApiSetupComplete() {
      return !!this._xmlrpcPort;
    }
  }, {
    key: 'shutdown',
    value: function shutdown() {
      this.emit('shutdown');
      return this._exit();
    }
  }, {
    key: '_setupSlaveApi',
    value: function _setupSlaveApi() {
      var _this9 = this;

      var xmlrpcPort = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      if (xmlrpcPort === null) {
        xmlrpcPort = 0;
      }

      return new Promise(function (resolve, reject) {
        var server = xmlrpc.createServer({ host: '0.0.0.0', port: xmlrpcPort }, function () {
          var _server$httpServer$ad = server.httpServer.address(),
              port = _server$httpServer$ad.port;

          _this9._debugLog.debug('Slave API Listening on port ' + port);
          _this9._xmlrpcPort = port;
          _this9._slaveApiServer = server;

          _this9._slaveApiServer.on('NotFound', function (method, params) {
            _this9._log.warn('Method ' + method + ' does not exist: ' + params);
          });

          _this9._slaveApiServer.on('requestTopic', _this9._handleTopicRequest.bind(_this9));
          _this9._slaveApiServer.on('publisherUpdate', _this9._handlePublisherUpdate.bind(_this9));
          _this9._slaveApiServer.on('paramUpdate', _this9._handleParamUpdate.bind(_this9));
          _this9._slaveApiServer.on('getPublications', _this9._handleGetPublications.bind(_this9));
          _this9._slaveApiServer.on('getSubscriptions', _this9._handleGetSubscriptions.bind(_this9));
          _this9._slaveApiServer.on('getPid', _this9._handleGetPid.bind(_this9));
          _this9._slaveApiServer.on('shutdown', _this9._handleShutdown.bind(_this9));
          _this9._slaveApiServer.on('getMasterUri', _this9._handleGetMasterUri.bind(_this9));
          _this9._slaveApiServer.on('getBusInfo', _this9._handleGetBusInfo.bind(_this9));
          _this9._slaveApiServer.on('getBusStats', _this9._handleGetBusStats.bind(_this9));
          resolve(port);
          _this9.emit('slaveApiSetupComplete', port);
        });

        server.httpServer.on('clientError', function (err, socket) {
          _this9._log.error('XMLRPC Server socket error: %j', err);
        });
      });
    }
  }, {
    key: '_setupTcprosServer',
    value: function _setupTcprosServer() {
      var _this10 = this;

      var tcprosPort = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      var _createServer = function _createServer(callback) {
        var server = net.createServer(function (connection) {
          var conName = connection.remoteAddress + ":" + connection.remotePort;
          connection.name = conName;
          _this10._debugLog.info('Node %s got connection from %s', _this10.getNodeName(), conName);

          // data from connections will be TCPROS encoded, so use a
          // DeserializeStream to handle any chunking
          var deserializeStream = new DeserializeStream();
          connection.$deserializeStream = deserializeStream;
          connection.pipe(deserializeStream);

          var checkConnectionHeader = function checkConnectionHeader(headerData) {
            var header = tcprosUtils.parseTcpRosHeader(headerData);
            if (!header) {
              _this10._log.error('Unable to validate connection header %s', headerData);
              connection.end(tcprosUtils.serializeString('Unable to validate connection header'));
              return;
            }
            _this10._debugLog.info('Got connection header: %j', header);

            if (header.hasOwnProperty('topic')) {
              // this is a subscriber, validate header and pass off connection to appropriate publisher
              var _topic = header.topic;
              var pub = _this10._publishers[_topic];
              if (pub) {
                pub.handleSubscriberConnection(connection, header);
              } else {
                // presumably this just means we shutdown the publisher after this
                // subscriber started trying to connect to us
                _this10._log.info('Got connection header for unknown topic %s', _topic);
              }
            } else if (header.hasOwnProperty('service')) {
              // this is a service client, validate header and pass off connection to appropriate service provider
              var service = header.service;
              var serviceProvider = _this10._services[service];
              if (serviceProvider) {
                serviceProvider.handleClientConnection(connection, header);
              }
            }
          };
          deserializeStream.once('message', checkConnectionHeader);
        });

        if (tcprosPort === null) {
          tcprosPort = 0;
        }
        server.listen(tcprosPort, '0.0.0.0');

        // it's possible the port was taken before we could use it
        server.on('error', function (err) {
          _this10._log.warn('Error on tcpros server! %j', err);
        });

        // the port was available
        server.on('listening', function () {
          var _server$address = server.address(),
              port = _server$address.port;

          _this10._debugLog.info('Listening on %j', server.address());
          _this10._tcprosPort = port;
          _this10._server = server;
          callback(port);
        });
      };

      return new Promise(function (resolve, reject) {
        _createServer(resolve);
      });
    }
  }, {
    key: '_handleTopicRequest',
    value: function _handleTopicRequest(err, params, callback) {
      this._debugLog.info('Got topic request ' + JSON.stringify(params));
      if (!err) {
        var _topic2 = params[1];
        var pub = this._publishers[_topic2];
        if (pub) {
          var port = this._tcprosPort;
          var resp = [1, 'Allocated topic connection on port ' + port, ['TCPROS', NetworkUtils.getHost(), port]];
          callback(null, resp);
        }
      } else {
        this._log.error('Error during topic request: %s, %j', _err, params);
        var _resp = [0, 'Unable to allocate topic connection for ' + topic, []];
        var _err = 'Error: Unknown topic ' + topic;
        callback(_err, _resp);
      }
    }

    /**
     * Handle publisher update message from master
     * @param err was there an error
     * @param params {Array} [caller_id, topic, publishers]
     * @param callback function(err, resp) call when done handling message
     */

  }, {
    key: '_handlePublisherUpdate',
    value: function _handlePublisherUpdate(err, params, callback) {
      this._debugLog.info('Publisher update ' + err + ' params: ' + JSON.stringify(params));
      var topic = params[1];
      var sub = this._subscribers[topic];
      if (sub) {
        this._debugLog.info('Got sub for topic ' + topic);
        var pubs = params[2];
        sub._handlePublisherUpdate(params[2]);
        var resp = [1, 'Handled publisher update for topic ' + topic, 0];
        callback(null, resp);
      } else {
        this._debugLog.warn('Got publisher update for unknown topic ' + topic);
        var _resp2 = [0, 'Don\'t have topic ' + topic, 0];
        var _err2 = 'Error: Unknown topic ' + topic;
        callback(_err2, _resp2);
      }
    }
  }, {
    key: '_handleParamUpdate',
    value: function _handleParamUpdate(err, params, callback) {
      this._log.info('Got param update! Not really doing anything with it...' + params);
    }
  }, {
    key: '_handleGetPublications',
    value: function _handleGetPublications(err, params, callback) {
      var _this11 = this;

      var pubs = [];
      Object.keys(this._publishers).forEach(function (topic) {
        var pub = _this11._publishers[topic];
        pubs.push([topic, pub.getType()]);
      });
      var resp = [1, 'Returning list of publishers on node ' + this._nodeName, pubs];
      callback(null, resp);
    }
  }, {
    key: '_handleGetSubscriptions',
    value: function _handleGetSubscriptions(err, params, callback) {
      var _this12 = this;

      var subs = [];
      Object.keys(this._subscribers).forEach(function (topic) {
        var sub = _this12._subscribers[topic];
        subs.push([topic, sub.getType()]);
      });
      var resp = [1, 'Returning list of publishers on node ' + this._nodeName, subs];
      callback(null, resp);
    }
  }, {
    key: '_handleGetPid',
    value: function _handleGetPid(err, params, callback) {
      var caller = params[0];
      callback(null, [1, 'Returning process id', process.pid]);
    }
  }, {
    key: '_handleShutdown',
    value: function _handleShutdown(err, params, callback) {
      var caller = params[0];
      this._log.warn('Received shutdown command from ' + caller);
      return this.shutdown();
    }
  }, {
    key: '_handleGetMasterUri',
    value: function _handleGetMasterUri(err, params, callback) {
      var resp = [1, 'Returning master uri for node ' + this._nodeName, this._rosMasterAddress];
      callback(null, resp);
    }
  }, {
    key: '_handleGetBusInfo',
    value: function _handleGetBusInfo(err, params, callback) {
      this._log.error('Not implemented');
    }
  }, {
    key: '_handleGetBusStats',
    value: function _handleGetBusStats(err, params, callback) {
      this._log.error('Not implemented');
    }

    // HAVEN'T TESTED YET

  }, {
    key: '_setupExitHandler',
    value: function _setupExitHandler() {
      // we need to catch that this process is about to exit so we can unregister all our
      // publishers, subscribers, and services
      var exited = false;

      var exitHandler = function exitHandler() {
        var _this13 = this;

        var killProcess = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        this._log.debug('Ros node ' + this._nodeName + ' beginning shutdown at ' + Date.now());
        var promises = [];

        // remove subscribers first so that master doesn't send
        // publisherUpdate messages
        Object.keys(this._subscribers).forEach(function (topic) {
          promises.push(_this13.unregisterSubscriber(topic));
        });

        Object.keys(this._publishers).forEach(function (topic) {
          promises.push(_this13.unregisterPublisher(topic));
        });

        Object.keys(this._services).forEach(function (service) {
          var serv = _this13._services[service];
          promises.push(_this13.unregisterService(service));
        });

        if (killProcess) {
          // we can't really block the exit process, just have to hope it worked...
          return Promise.all(promises).then(function () {
            process.exit();
          }).catch(function (err) {
            process.exit();
          });
        }
        // else
        return Promise.all(promises);
      };

      var once = function once(func) {
        var exited = false;
        return function () {
          if (exited) {
            // this is getting called a second time - probably after SIGINT
            return;
          }
          // else
          exited = true;
          return func.apply(this, arguments);
        };
      };

      this._exit = once(exitHandler);

      process.on('exit', this._exit.bind(this));
      process.on('SIGINT', this._exit.bind(this, true));
    }
  }]);

  return RosNode;
}(EventEmitter);

;

//------------------------------------------------------------------

module.exports = RosNode;