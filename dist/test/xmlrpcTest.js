'use strict';

var net = require('net');
var chai = require('chai');
var expect = chai.expect;
var rosnodejs = require('../index.js');
var Subscriber = require('../lib/Subscriber.js');
var xmlrpc = require('xmlrpc');
var netUtils = require('../utils/network_utils.js');

var MASTER_PORT = 11234;

// helper function to throw errors outside a promise scope
// so they actually trigger failures
function throwNext(msg) {
  process.nextTick(function () {
    throw new Error(msg);
  });
}

describe('Protocol Test', function () {
  // NOTE: make sure a roscore is not running (or something else at this address)
  rosnodejs.require('std_msgs');
  rosnodejs.require('std_srvs');
  var masterStub = void 0;
  var nodeName = '/testNode';

  before(function (done) {
    masterStub = xmlrpc.createServer({ host: 'localhost', port: MASTER_PORT }, function () {
      done();
    });
  });

  after(function (done) {
    masterStub.close(function () {
      done();
    });
  });

  describe('Xmlrpc', function () {

    beforeEach(function () {
      masterStub.on('getUri', function (err, params, callback) {
        var resp = [1, '', 'localhost:' + MASTER_PORT + '/'];
        callback(null, resp);
      });

      return rosnodejs.initNode(nodeName, { rosMasterUri: 'http://localhost:' + MASTER_PORT, logging: { skipRosLogging: true } });
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

    it('registerSubscriber', function (done) {
      var topic = '/test_topic';
      var msgType = 'std_msgs/String';
      masterStub.on('registerSubscriber', function (err, params, callback) {
        expect(params.length).to.equal(4);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(topic);
        expect(params[2]).to.equal(msgType);
        expect(params[3].startsWith('http://')).to.be.true;

        var info = netUtils.getAddressAndPortFromUri(params[3]);
        expect(info.host).to.be.a('string');
        expect(info.host.length).to.not.equal(0);
        expect(info.port).to.be.a('string');
        expect(info.port.length).to.not.equal(0);

        var resp = [1, 'registered!', []];
        callback(null, resp);
        done();
      });

      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, msgType, function (data) {}, { queueSize: 1, throttleMs: 1000 });
    });

    it('unregisterSubscriber', function (done) {
      var topic = '/test_topic';
      var msgType = 'std_msgs/String';
      var nodeUri = void 0;

      masterStub.on('registerSubscriber', function (err, params, callback) {
        nodeUri = params[3];

        var resp = [1, 'registered!', []];
        callback(null, resp);
      });

      masterStub.on('unregisterSubscriber', function (err, params, callback) {
        expect(params.length).to.equal(3);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(topic);
        expect(params[2]).to.equal(nodeUri);

        var resp = [1, 'unregistered!', []];
        callback(null, resp);
        done();
      });

      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, msgType, function (data) {}, { queueSize: 1, throttleMs: 1000 });

      sub.on('registered', function () {
        nh.unsubscribe(topic);
      });
    });

    it('registerPublisher', function (done) {
      var topic = '/test_topic';
      var msgType = 'std_msgs/String';
      masterStub.on('registerPublisher', function (err, params, callback) {
        expect(params.length).to.equal(4);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(topic);
        expect(params[2]).to.equal(msgType);
        expect(params[3].startsWith('http://')).to.be.true;

        var info = netUtils.getAddressAndPortFromUri(params[3]);
        expect(info.host).to.be.a('string');
        expect(info.host.length).to.not.equal(0);
        expect(info.port).to.be.a('string');
        expect(info.port.length).to.not.equal(0);

        var resp = [1, 'registered!', []];
        callback(null, resp);
        done();
      });

      var nh = rosnodejs.getNodeHandle();
      var pub = nh.advertise(topic, msgType, { latching: true,
        queueSize: 1,
        throttleMs: 1000 });
    });

    it('unregisterPublisher', function (done) {
      var topic = '/test_topic';
      var msgType = 'std_msgs/String';
      var nodeUri = void 0;

      masterStub.on('registerPublisher', function (err, params, callback) {
        nodeUri = params[3];

        var resp = [1, 'registered!', []];
        callback(null, resp);
      });

      masterStub.on('unregisterPublisher', function (err, params, callback) {
        expect(params.length).to.equal(3);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(topic);
        expect(params[2]).to.equal(nodeUri);

        var resp = [1, 'unregistered!', []];
        callback(null, resp);
        done();
      });

      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType, { latching: true,
        queueSize: 1,
        throttleMs: 1000 });

      pub.on('registered', function () {
        nh.unadvertise(topic);
      });
    });

    it('registerService', function (done) {
      var service = '/test_service';
      var srvType = 'std_srvs/Empty';
      masterStub.on('registerService', function (err, params, callback) {
        expect(params.length).to.equal(4);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(service);
        expect(params[2].startsWith('rosrpc://')).to.be.true;

        var info = netUtils.getAddressAndPortFromUri(params[2]);
        expect(info.host).to.be.a('string');
        expect(info.host.length).to.not.equal(0);
        expect(info.port).to.be.a('string');
        expect(info.port.length).to.not.equal(0);

        expect(params[3].startsWith('http://')).to.be.true;

        info = netUtils.getAddressAndPortFromUri(params[3]);
        expect(info.host).to.be.a('string');
        expect(info.host.length).to.not.equal(0);
        expect(info.port).to.be.a('string');
        expect(info.port.length).to.not.equal(0);

        var resp = [1, 'registered!', []];
        callback(null, resp);
      });

      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {});
      serv.on('registered', done);
    });

    it('unregisterService', function (done) {
      var service = '/test_service';
      var srvType = 'std_srvs/Empty';
      var serviceUri = null;
      masterStub.on('registerService', function (err, params, callback) {
        serviceUri = params[2];

        var resp = [1, 'registered!', ''];
        callback(null, resp);
      });

      masterStub.on('unregisterService', function (err, params, callback) {
        expect(params.length).to.equal(3);
        expect(params[0]).to.equal(nodeName);
        expect(params[1]).to.equal(service);
        expect(params[2]).to.equal(serviceUri);

        var resp = [1, 'unregistered!', []];
        callback(null, resp);
        done();
      });

      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {});

      serv.on('registered', function () {
        nh.unadvertiseService(service);
      });
    });
  });

  describe('Pub-Sub', function () {
    var topic = '/test_topic';
    var msgType = 'std_msgs/Int8';

    beforeEach(function () {
      var pubInfo = null;
      var subInfo = null;

      masterStub.on('getUri', function (err, params, callback) {
        var resp = [1, '', 'localhost:11311/'];
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

      return rosnodejs.initNode(nodeName);
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

    it('Basic', function (done) {
      var nh = rosnodejs.nh;
      var valsToSend = [1, 2, 3];
      var valsReceived = new Set(valsToSend);
      var pub = nh.advertise(topic, msgType, { queueSize: 3 });

      var sub = nh.subscribe(topic, msgType, function (data) {
        valsReceived.delete(data.data);
        if (valsReceived.size === 0) {
          done();
        }
      }, { queueSize: 3 });

      pub.on('connection', function () {
        valsToSend.forEach(function (val) {
          pub.publish({ data: val });
        });
      });
    });

    it('Latch', function (done) {
      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType, { latching: true });

      pub.publish({ data: 1 });

      pub.on('registered', function () {
        var sub = nh.subscribe(topic, msgType, function (data) {
          done();
        });
      });
    });

    it('Invalid Without Resolve Causes Error', function (done) {
      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, 'std_msgs/String');

      // NOTE: you'll see an error logged here - THAT'S OK
      // WE'RE EXPECTING AN ERROR TO LOG
      var logCapture = {
        write: function write(rec) {
          if (rec.level === rosnodejs.log.levelFromName['error'] && rec.msg.startsWith('Error when publishing')) {
            done();
          }
        }
      };

      rosnodejs.log.addStream({
        type: 'raw',
        name: 'testCapture',
        stream: logCapture,
        level: 'error'
      });

      Promise.resolve().then(function () {
        sub.on('registered', function () {
          var pub = nh.advertise(topic, 'std_msgs/String', { latching: true });

          pub.on('connection', function () {
            pub.publish({});
          });
        });
      }).catch(function (err) {
        console.log(err);
        done();
      });
    });

    it('Resolve', function (done) {
      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, 'std_msgs/String', function (data) {
        done();
      });

      sub.on('registered', function () {
        var pub = nh.advertise(topic, 'std_msgs/String', { latching: true, resolve: true });

        pub.on('registered', function () {
          pub.publish({});
        });
      });
    });

    it('Throttle Pub', function (done) {
      this.slow(1000);

      var nh = rosnodejs.nh;
      var valsToSend = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var pub = nh.advertise(topic, msgType, { queueSize: 1, throttleMs: 100 });
      var numMsgsReceived = 0;

      var sub = nh.subscribe(topic, msgType, function (data) {
        ++numMsgsReceived;
        if (data.data === valsToSend[valsToSend.length - 1]) {
          expect(numMsgsReceived).to.equal(valsToSend.length / 2 + 1);
          done();
        }
      }, { queueSize: 1 });

      pub.on('connection', function () {
        valsToSend.forEach(function (val, index) {
          setTimeout(function () {
            pub.publish({ data: val });
          }, 50 * index);
        });
      });
    });

    it('Disconnect Pub', function (done) {
      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType);
      var sub = nh.subscribe(topic, msgType, function (data) {
        expect(pub.getNumSubscribers()).to.equal(1);
        expect(sub.getNumPublishers()).to.equal(1);

        pub.shutdown();

        expect(pub.getNumSubscribers()).to.equal(0);
        sub.on('disconnect', function () {
          expect(sub.getNumPublishers()).to.equal(0);
          done();
        });
      });

      pub.on('connection', function () {
        pub.publish({ data: 1 });
      });
    });

    it('Disconnect Sub', function (done) {
      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType);
      var sub = nh.subscribe(topic, msgType, function (data) {
        expect(pub.getNumSubscribers()).to.equal(1);
        expect(sub.getNumPublishers()).to.equal(1);

        sub.shutdown();

        expect(sub.getNumPublishers()).to.equal(0);
        pub.on('disconnect', function () {
          expect(pub.getNumSubscribers()).to.equal(0);
          done();
        });
      });

      pub.on('connection', function () {
        pub.publish({ data: 1 });
      });
    });

    it('Shutdown Subscriber During Registration', function (done) {
      this.slow(1600);
      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, msgType);

      sub.on('registered', function () {
        throwNext('Subscriber should never have registered!');
      });

      sub.shutdown();

      // if we haven't seen the 'registered' event by now we should be good
      setTimeout(done, 500);
    });

    it('Shutdown Subscriber Requesting Topic', function (done) {
      this.slow(1600);
      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType);

      pub.on('registered', function () {
        var sub = nh.subscribe(topic, msgType);
        sub.on('registered', function () {
          sub.shutdown();
        });
        sub.on('connection', function () {
          throwNext('Sub should not have gotten connection');
        });
      });

      // if we haven't seen thrown by now we should be good
      setTimeout(done, 500);
    });

    it('Shutdown Subscriber Connecting to Publisher', function (done) {
      this.slow(1600);
      var nh = rosnodejs.nh;
      // manually construct a subscriber...
      var sub = new Subscriber({
        topic: topic,
        type: 'std_msgs/String',
        typeClass: rosnodejs.require('std_msgs').msg.String
      }, nh._node);

      var SOCKET_CONNECT_CACHED = net.Socket.prototype.connect;
      var SOCKET_END_CACHED = net.Socket.prototype.end;

      sub.on('registered', function () {

        net.Socket.prototype.connect = function (port, address, callback) {
          process.nextTick(function () {
            callback();
          });
        };

        net.Socket.prototype.end = function () {
          process.nextTick(function () {
            net.Socket.prototype.connect = SOCKET_CONNECT_CACHED;
            net.Socket.prototype.end = SOCKET_END_CACHED;

            done();
          });

          // even though we didn't actually connect, this socket seems to make
          // the suite hang unless we call the actual Socket.prototype.end()
          SOCKET_END_CACHED.call(this);
        };

        sub._handleTopicRequestResponse([1, 'ok', ['TCPROS', 'junk_address', 1234]], 'http://junk_address:1234');
        sub.shutdown();
      });
    });

    it('Shutdown Publisher During Registration', function (done) {
      this.slow(1600);
      var nh = rosnodejs.nh;
      var pub = nh.advertise(topic, msgType);

      pub.on('registered', function () {
        throwNext('Publisher should never have registered!');
      });

      pub.shutdown();

      // if we haven't seen the 'registered' event by now we should be good
      setTimeout(done, 500);
    });

    it('Shutdown Publisher With Queued Message', function (done) {
      this.slow(1600);
      var nh = rosnodejs.nh;
      var sub = nh.subscribe(topic, msgType, function () {
        throwNext('Subscriber should never have gotten messages!');
      });
      var pub = nh.advertise(topic, msgType);

      pub.on('connected', function () {
        pub.publish({ data: 1 });
        pub.shutdown();
      });

      // if we haven't received a message by now we should be good
      setTimeout(done, 500);
    });
  });

  describe('Service', function () {
    var service = '/test_service';
    var srvType = 'std_srvs/Empty';

    beforeEach(function () {
      var serviceInfo = null;

      masterStub.on('getUri', function (err, params, callback) {
        var resp = [1, '', 'localhost:11311/'];
        callback(null, resp);
      });

      masterStub.on('registerService', function (err, params, callback) {
        serviceInfo = params[2];

        var resp = [1, 'You did it!', []];
        callback(null, resp);
      });

      masterStub.on('unregisterService', function (err, params, callback) {
        var resp = [1, 'You did it!', serviceInfo ? 1 : 0];
        callback(null, resp);
        serviceInfo = null;
      });

      masterStub.on('lookupService', function (err, params, callback) {
        if (serviceInfo) {
          var resp = [1, "you did it", serviceInfo];
          callback(null, resp);
        } else {
          var _resp = [-1, "no provider", ""];
          callback(null, _resp);
        }
      });

      return rosnodejs.initNode(nodeName);
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

    it('Call and Response', function (done) {
      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {
        return true;
      });

      var client = nh.serviceClient(service, srvType);
      nh.waitForService(service).then(function () {
        return client.call({});
      }).then(function () {
        done();
      }).catch(function (err) {
        throwNext(err);
      });
    });

    it('Service Failure', function (done) {
      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {
        return false;
      });

      var client = nh.serviceClient(service, srvType);
      nh.waitForService(service).then(function () {
        return client.call({});
      }).then(function () {
        throwNext('Service call succeeded when it shouldn\'t have');
      }).catch(function (err) {
        if (err.code === 'E_ROSSERVICEFAILED') {
          done();
        } else {
          console.error('Service call failed with unexpected error');
        }
      });
    });

    it('Service Shutdown While Registering', function (done) {
      this.slow(1600);

      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {
        return true;
      });

      // hook into registered event - this should not fire
      serv.on('registered', function () {
        throw new Error('Service should never have registered!');
      });

      // kill the service while the asynchronous registration is happening
      serv.shutdown();

      // if we haven't seen the 'registered' event by now we should be good
      setTimeout(done, 500);
    });

    it('Service Shutdown During Call', function (done) {
      this.slow(1600);

      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {
        throw new Error('Service callback should never have been called!');
      });

      var connected = false;
      serv.on('connection', function () {
        // we've received the client header but not the request - SHUT IT DOWN
        connected = true;
        serv.shutdown();
      });

      var client = nh.serviceClient(service, srvType);
      nh.waitForService(service).then(function () {
        client.call({});
      });

      // if the service callback hasn't been called by now we should be good
      setTimeout(done, 500);
    });

    it('Service Unregistered During Call', function (done) {
      // simulate a service disconnecting between the lookupService call to ROS Master
      // and the connection to the service node's TCPROS server

      // cache a reference to net.connect - we'll replace it
      var NET_CONNECT_FUNC = net.connect;

      var nh = rosnodejs.nh;
      var serv = nh.advertiseService(service, srvType, function (req, resp) {
        return true;
      });

      var client = nh.serviceClient(service, srvType);
      nh.waitForService(service).then(function () {

        // we've verified that the service exists - replace the net.connect call (used to initiate the TCPROS
        // connection) with a bogus one that throws an error
        net.connect = function (info) {
          var sock = new net.Socket();
          process.nextTick(function () {
            var error = new Error('connect ECONNREFUSED ' + info.host + ':' + info.port);
            error.code = 'ECONNREFUSED';
            error.errno = 'ECONNREFUSED';
            error.address = info.host;
            error.port = info.port;

            // just to make sure there isn't some other error that comes through - should be unnecessary
            error.rosnodejstesting = true;
            sock.emit('error', error);
          });
          return sock;
        };

        return client.call({});
      }).catch(function (err) {
        if (err.code === 'ECONNREFUSED' && err.rosnodejstesting) {
          // nice! restore net.connect and close up shop
          net.connect = NET_CONNECT_FUNC;
          done();
        }
      });
    });
  });
});