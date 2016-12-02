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

var xmlrpc = require('xmlrpc');
var networkUtils = require('../utils/network_utils.js');
var Logging = require('./Logging.js');
var XmlrpcClient = require('../utils/XmlrpcClient.js');

//-----------------------------------------------------------------------

var MasterApiClient = function () {
  function MasterApiClient(rosMasterUri, logName) {
    _classCallCheck(this, MasterApiClient);

    this._log = Logging.getLogger(Logging.DEFAULT_LOGGER_NAME + '.masterapi');
    this._log.info('Connecting to ROS Master at ' + rosMasterUri);
    this._xmlrpcClient = new XmlrpcClient(networkUtils.getAddressAndPortFromUri(rosMasterUri), this._log);
  }

  _createClass(MasterApiClient, [{
    key: 'getXmlrpcClient',
    value: function getXmlrpcClient() {
      return this._xmlrpcClient;
    }
  }, {
    key: '_call',
    value: function _call(method, data, resolve, reject) {
      this._xmlrpcClient.call(method, data, resolve, reject);
    }
  }, {
    key: 'registerService',
    value: function registerService(callerId, service, serviceUri, uri) {
      var _this = this;

      var data = [callerId, service, serviceUri, uri];

      return new Promise(function (resolve, reject) {
        _this._call('registerService', data, resolve, reject);
      });
    }
  }, {
    key: 'unregisterService',
    value: function unregisterService(callerId, service, serviceUri) {
      var _this2 = this;

      var data = [callerId, service, serviceUri];

      return new Promise(function (resolve, reject) {
        _this2._call('unregisterService', data, resolve, reject);
      });
    }
  }, {
    key: 'registerSubscriber',
    value: function registerSubscriber(callerId, topic, topicType, uri) {
      var _this3 = this;

      var data = [callerId, topic, topicType, uri];
      return new Promise(function (resolve, reject) {
        _this3._call('registerSubscriber', data, resolve, reject);
      });
    }
  }, {
    key: 'unregisterSubscriber',
    value: function unregisterSubscriber(callerId, topic, uri) {
      var _this4 = this;

      var data = [callerId, topic, uri];
      return new Promise(function (resolve, reject) {
        _this4._call('unregisterSubscriber', data, resolve, reject);
      });
    }
  }, {
    key: 'registerPublisher',
    value: function registerPublisher(callerId, topic, topicType, uri) {
      var _this5 = this;

      var data = [callerId, topic, topicType, uri];
      return new Promise(function (resolve, reject) {
        _this5._call('registerPublisher', data, resolve, reject);
      });
    }
  }, {
    key: 'unregisterPublisher',
    value: function unregisterPublisher(callerId, topic, uri) {
      var _this6 = this;

      var data = [callerId, topic, uri];
      return new Promise(function (resolve, reject) {
        _this6._call('unregisterPublisher', data, resolve, reject);
      });
    }
  }, {
    key: 'lookupNode',
    value: function lookupNode(callerId, nodeName) {
      var _this7 = this;

      var data = [callerId, nodeName];
      return new Promise(function (resolve, reject) {
        _this7._call('lookupNode', data, resolve, reject);
      });
    }
  }, {
    key: 'getPublishedTopics',
    value: function getPublishedTopics(callerId, subgraph) {
      throw new Error('NOT SUPPORTED');
    }
  }, {
    key: 'getTopicTypes',
    value: function getTopicTypes(callerId) {
      throw new Error('NOT SUPPORTED');
    }

    /** return an object containing all current publishers (by topic),
        subscribers (by topic), and services (by name) */

  }, {
    key: 'getSystemState',
    value: function getSystemState(callerId) {
      var _this8 = this;

      function toObject(memo, sublist) {
        memo[sublist[0]] = sublist[1];
        return memo;
      }
      var data = [callerId];
      return new Promise(function (resolve, reject) {
        _this8._call('getSystemState', data, function (data) {
          return resolve({
            publishers: data[2][0].reduce(toObject, {}),
            subscribers: data[2][1].reduce(toObject, {}),
            services: data[2][2].reduce(toObject, {})
          });
        }, reject);
      });
    }
  }, {
    key: 'getUri',
    value: function getUri(callerId) {
      var _this9 = this;

      var data = [callerId];
      return new Promise(function (resolve, reject) {
        _this9._call('getUri', data, resolve, reject);
      });
    }
  }, {
    key: 'lookupService',
    value: function lookupService(callerId, service) {
      var _this10 = this;

      var data = [callerId, service];
      return new Promise(function (resolve, reject) {
        _this10._call('lookupService', data, resolve, reject);
      });
    }
  }]);

  return MasterApiClient;
}();

;

//-----------------------------------------------------------------------

module.exports = MasterApiClient;