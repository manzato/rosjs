'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var chai = require('chai');
var expect = chai.expect;
var bunyan = require('bunyan');
var xmlrpc = require('xmlrpc');
var rosnodejs = require('../index.js');

var MASTER_PORT = 11234;

/** setup pipe to stdout **/

var OutputCapture = function () {
  function OutputCapture() {
    _classCallCheck(this, OutputCapture);

    this.flush();
  }

  _createClass(OutputCapture, [{
    key: 'write',
    value: function write(data) {
      this.lastMsg = data;
    }
  }, {
    key: 'flush',
    value: function flush() {
      this.lastMsg = null;
    }
  }, {
    key: 'get',
    value: function get() {
      return this.lastMsg;
    }
  }]);

  return OutputCapture;
}();

describe('Logging', function () {
  var outputCapture = new OutputCapture();

  var reset = function reset() {
    outputCapture.flush();
    expect(outputCapture.get()).to.equal(null);

    rosnodejs.log.rootLogger._throttledLogs = new Map();
    rosnodejs.log.rootLogger._onceLogs = new Set();
  };

  before(function () {
    rosnodejs.log.addStream({
      type: 'raw',
      level: 'info',
      stream: outputCapture
    });

    rosnodejs.log.setLevel('trace');
  });

  after(function () {
    rosnodejs.reset();
  });

  it('Levels', function () {
    var message = 'This is my message';
    reset();

    rosnodejs.log.setLevel('fatal');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get()).to.equal(null);
    reset();

    rosnodejs.log.setLevel('error');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get()).to.equal(null);
    reset();

    rosnodejs.log.setLevel('warn');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get()).to.equal(null);
    reset();

    rosnodejs.log.setLevel('info');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get()).to.equal(null);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get()).to.equal(null);
    reset();

    rosnodejs.log.setLevel('debug');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get()).to.equal(null);
    reset();

    rosnodejs.log.setLevel('trace');
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get().msg).to.have.string(message);
    reset();
  });

  it('Throttling', function () {
    var message = 'This is my message';
    reset();
    rosnodejs.log.infoThrottle(1000, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.INFO);

    outputCapture.flush();
    rosnodejs.log.infoThrottle(1000, message);
    expect(outputCapture.get()).to.be.null;
  });

  it('Bound Log Methods', function () {
    var message = 'This is my message';

    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.TRACE);

    reset();
    rosnodejs.log.debug(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.DEBUG);

    reset();
    rosnodejs.log.info(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.INFO);

    reset();
    rosnodejs.log.warn(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.WARN);

    reset();
    rosnodejs.log.error(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.ERROR);

    reset();
    rosnodejs.log.fatal(message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.FATAL);

    reset();
    rosnodejs.log.traceThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.TRACE);

    reset();
    rosnodejs.log.debugThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.DEBUG);

    reset();
    rosnodejs.log.infoThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.INFO);

    reset();
    rosnodejs.log.warnThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.WARN);

    reset();
    rosnodejs.log.errorThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.ERROR);

    reset();
    rosnodejs.log.fatalThrottle(1, message);
    expect(outputCapture.get().msg).to.have.string(message);
    expect(outputCapture.get().level).to.equal(bunyan.FATAL);
  });

  it('Child Loggers', function () {
    var message = 'This is my message';

    var testLogger = rosnodejs.log.getLogger('testLogger');

    // individually set log level
    reset();
    testLogger.setLevel('info');
    testLogger.info(message);
    expect(outputCapture.get().msg).to.have.string(message);

    reset();
    testLogger.trace(message);
    expect(outputCapture.get()).to.equal(null);

    // root log should still be at trace
    reset();
    rosnodejs.log.trace(message);
    expect(outputCapture.get().msg).to.have.string(message);

    // setting through rosnodejs should set all loggers
    rosnodejs.log.setLevel('trace');
    reset();
    testLogger.trace(message);
    expect(outputCapture.get().msg).to.have.string(message);
  });

  describe('Rosout', function () {
    var masterStub = void 0;
    before(function (done) {
      rosnodejs.reset();
      masterStub = xmlrpc.createServer({ host: 'localhost', port: MASTER_PORT }, function () {
        done();
      });
    });

    after(function (done) {
      masterStub.close(function () {
        done();
      });
    });

    beforeEach(function () {
      var pubInfo = null;
      var subInfo = null;

      masterStub.on('getUri', function (err, params, callback) {
        var resp = [1, '', 'localhost:' + MASTER_PORT + '/'];
        callback(null, resp);
      });

      masterStub.on('registerSubscriber', function (err, params, callback) {
        subInfo = params[3];
        //console.log('sub reg ' + params);
        //console.log(pubInfo);

        var resp = [1, 'You did it!', []];
        if (pubInfo) {
          resp[2].push(pubInfo);
        }
        callback(null, resp);
      });

      masterStub.on('unregisterSubscriber', function (err, params, callback) {
        var resp = [1, 'You did it!', subInfo ? 1 : 0];
        callback(null, resp);
        subInfo = null;
      });

      masterStub.on('registerPublisher', function (err, params, callback) {
        //console.log('pub reg');
        pubInfo = params[3];
        var resp = [1, 'You did it!', []];
        if (subInfo) {
          resp[2].push(pubInfo);
          var subAddrParts = subInfo.replace('http://', '').split(':');
          var client = xmlrpc.createClient({ host: subAddrParts[0], port: subAddrParts[1] });
          var data = [1, topic, [pubInfo]];
          client.methodCall('publisherUpdate', data, function (err, response) {});
        }
        callback(null, resp);
      });

      masterStub.on('unregisterPublisher', function (err, params, callback) {
        var resp = [1, 'You did it!', pubInfo ? 1 : 0];
        callback(null, resp);
        pubInfo = null;
      });

      masterStub.on('registerService', function (err, params, callback) {
        var resp = [1, 'You did it!', 1];
        callback(null, resp);
      });

      masterStub.on('unregisterService', function (err, params, callback) {
        var resp = [1, 'You did it!', 1];
        callback(null, resp);
      });

      // rosnodejs.log.setLevel('info');
      return rosnodejs.initNode('/testNode', { logging: { waitOnRosOut: false, level: 'info' },
        rosMasterUri: 'http://localhost:' + MASTER_PORT });
    });

    afterEach(function () {
      var nh = rosnodejs.nh;

      // clear out any service, subs, pubs
      nh._node._services = {};
      nh._node._subscribers = {};
      nh._node._publishers = {};

      // remove any master api handlers we set up
      masterStub.removeAllListeners();
    });

    it('Check Publishing', function (done) {
      rosnodejs.log.setLevel('fatal');
      var testLogger = rosnodejs.log.getLogger('testLogger');
      testLogger.setLevel('info');
      var nh = rosnodejs.nh;
      var message = 'This is my message';
      var intervalId = null;

      var rosoutCallback = function rosoutCallback(msg) {
        console.log('ros out %j', msg);
        expect(msg.msg).to.have.string(message);
        if (intervalId !== null) {
          nh.unsubscribe('/rosout');
          clearInterval(intervalId);
          intervalId = null;
          done();
        }
      };

      var sub = nh.subscribe('/rosout', 'rosgraph_msgs/Log', rosoutCallback);

      intervalId = setInterval(function () {
        testLogger.info(message);
      }, 50);
    });
  });
});