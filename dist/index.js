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

//------------------------------------------------------------------

var netUtils = require('./utils/network_utils.js');
var msgUtils = require('./utils/message_utils.js');
var messages = require('./utils/messageGeneration/messages.js');
var util = require('util');
var RosLogStream = require('./utils/log/RosLogStream.js');
var ConsoleLogStream = require('./utils/log/ConsoleLogStream.js');
var LogFormatter = require('./utils/log/LogFormatter.js');
var RosNode = require('./lib/RosNode.js');
var NodeHandle = require('./lib/NodeHandle.js');
var Logging = require('./lib/Logging.js');
var ActionClient = require('./lib/ActionClient.js');

var MsgLoader = require('./utils/messageGeneration/MessageLoader.js');

// these will be modules, they depend on logger which isn't initialized yet
// though so they'll be required later (in initNode)
// let RosNode = null;
// let NodeHandle = null;

// will be initialized through call to initNode
var log = Logging.getLogger();
var rosNode = null;

//------------------------------------------------------------------

function _checkMasterHelper() {
  var timeout = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 500;

  var firstCheck = true;

  var localHelper = function localHelper(resolve) {
    setTimeout(function () {
      // also check that the slave api server is set up
      if (!rosNode.slaveApiSetupComplete()) {
        localHelper(resolve);
        return;
      }
      // else
      if (firstCheck) {
        // hook into master api connection errors.
        // api client will continue trying to connect
        rosNode._masterApi.getXmlrpcClient().once('ECONNREFUSED', function (err) {
          log.warn('Unable to register with master node [' + rosNode.getRosMasterUri() + ']: master may not be running yet. Will keep trying.');
        });
        firstCheck = false;
      }
      rosNode.getMasterUri().then(function () {
        log.infoOnce('Connected to master at ' + rosNode.getRosMasterUri() + '!');
        resolve();
      }).catch(function (err, resp) {
        log.warnThrottle(60000, 'Unable to connect to master. ' + err);
        localHelper(resolve);
      });
    }, timeout);
  };

  return new Promise(function (resolve, reject) {
    localHelper(resolve);
  });
}

/**
 * Very basic validation of node name - needs to start with a '/'
 * TODO: more
 * @return {string} name of node after validation
 */
function _validateNodeName(nodeName) {
  if (!nodeName.startsWith('/')) {
    nodeName = '/' + nodeName;
  }
  return nodeName;
}

/**
 * Appends a random string of numeric characters to the end
 * of the node name. Follows rospy logic.
 * @param nodeName {string} string to anonymize
 * @return {string} anonymized nodeName
 */
function _anonymizeNodeName(nodeName) {
  return util.format('%s_%s_%s', nodeName, process.pid, Date.now());
}

var Rosnodejs = {
  /**
   * Initializes a ros node for this process. Only one ros node can exist per process
   * If called a second time with the same nodeName, returns a handle to that node.
   * @param nodeName {string} name of the node to initialize
   * @param options {object} overrides for this node
   * @return {Promise} resolved when connection to master is established
   */
  initNode: function initNode(nodeName, options) {
    var _this = this;

    options = options || {};
    if (options.anonymous) {
      nodeName = _anonymizeNodeName(nodeName);
    }

    nodeName = _validateNodeName(nodeName);

    if (rosNode !== null) {
      if (nodeName === rosNode.getNodeName()) {
        return Promise.resolve(this.getNodeHandle());
      }
      // else
      throw new Error('Unable to initialize node [' + nodeName + '] - node [' + rosNode.getNodeName() + '] already exists');
    }

    var rosMasterUri = process.env.ROS_MASTER_URI;
    if (options.rosMasterUri) {
      rosMasterUri = options.rosMasterUri;
    }

    Logging.initializeNodeLogger(nodeName, options.logging);

    // create the ros node. Return a promise that will
    // resolve when connection to master is established
    rosNode = new RosNode(nodeName, rosMasterUri);

    return this._loadOnTheFlyMessages(options).then(_checkMasterHelper).then(Logging.initializeRosOptions.bind(Logging, this, options.logging)).then(function () {
      return _this.getNodeHandle();
    }).catch(function (err) {
      log.error('Error: ' + err);
    });
  },
  reset: function reset() {
    rosNode = null;
  },
  _loadOnTheFlyMessages: function _loadOnTheFlyMessages(_ref) {
    var onTheFly = _ref.onTheFly;

    if (onTheFly) {
      return new Promise(function (resolve, reject) {
        messages.getAll(resolve);
      });
    }
    // else
    return Promise.resolve();
  },
  loadPackage: function loadPackage(packageName) {
    var outputDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var verbose = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    var msgLoader = new MsgLoader(verbose);
    if (!outputDir) {
      outputDir = msgUtils.getTopLevelMessageDirectory();
    }
    return msgLoader.buildPackage(packageName, outputDir).then(function () {
      console.log('Finished building messages!');
    }).catch(function (err) {
      console.error(err);
    });
  },
  loadAllPackages: function loadAllPackages() {
    var outputDir = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var verbose = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    var msgLoader = new MsgLoader(verbose);
    if (!outputDir) {
      outputDir = msgUtils.getTopLevelMessageDirectory();
    }
    return msgLoader.buildPackageTree(outputDir).then(function () {
      console.log('Finished building messages!');
    });
  },
  require: function require(msgPackage) {
    return msgUtils.requireMsgPackage(msgPackage);
  },


  /** check that a message definition is loaded for a ros message
      type, e.g., geometry_msgs/Twist */
  checkMessage: function checkMessage(type) {
    var parts = type.split('/');
    var rtv = void 0;
    try {
      rtv = this.require(parts[0]).msg[parts[1]];
    } catch (e) {}
    return rtv;
  },


  /** check that a service definition is loaded for a ros service
      type, e.g., turtlesim/TeleportRelative */
  checkService: function checkService(type) {
    var parts = type.split('/');
    var rtv = void 0;
    try {
      rtv = this.require(parts[0]).srv[parts[1]];
    } catch (e) {}
    return rtv;
  },


  /**
   * @return {NodeHandle} for initialized node
   */
  getNodeHandle: function getNodeHandle() {
    return new NodeHandle(rosNode);
  },


  get nodeHandle() {
    return new NodeHandle(rosNode);
  },

  get nh() {
    return new NodeHandle(rosNode);
  },

  get log() {
    return Logging;
  },

  get logStreams() {
    return {
      console: ConsoleLogStream,
      ros: RosLogStream
    };
  },

  //------------------------------------------------------------------
  // ActionLib
  //------------------------------------------------------------------

  /**
    Get an action client for a given type and action server.
     Example:
      let ac = rosNode.getActionClient({
        type: "turtle_actionlib/ShapeAction",
        actionServer: "/turtle_shape"
      });
      let shapeActionGoal =
        rosnodejs.require('turtle_actionlib').msg.ShapeActionGoal;
      ac.sendGoal(new shapeActionGoal({
        goal: { edges: 3,  radius: 1 } }));
   */
  getActionClient: function getActionClient(options) {
    options.nh = this.nh;
    return new ActionClient(options);
  }
};

module.exports = Rosnodejs;