'use strict';

var chai = require('chai');
var xmlrpc = require('xmlrpc');
var rosnodejs = require('rosnodejs');

var TOPIC = '/topic';
var TYPE = 'std_msgs/String';
var SERVICE = '/service';
var SRV = 'std_srvs/Empty';

var MASTER_PORT = 11234;

// Each Test in this suite simulates rapid fire connection/disconnection
// of TCPROS clients
describe('ClientShutdown', function () {

  this.timeout(10000);
  this.slow(10000);

  var sub = null;
  var pub = null;
  var service = null;
  var client = null;

  var interval1 = void 0;
  var interval2 = void 0;
  var interval3 = void 0;

  var masterStub = void 0;

  function startSub(nh) {
    sub = nh.subscribe(TOPIC, TYPE, function (msg) {
      console.log('%j', msg);
    });

    return sub;
  }

  function stopSub() {
    if (sub) {
      sub.shutdown();
      sub = null;
    }
  }

  function startPub(nh) {
    pub = nh.advertise(TOPIC, TYPE);
    return pub;
  }

  function stopPub() {
    if (pub) {
      pub.shutdown();
      pub = null;
    }
  }

  function startService(nh) {
    service = nh.advertiseService(SERVICE, SRV, function () {
      console.log('handling service call');
      return true;
    });
    return service;
  }

  function stopService() {
    if (service) {
      service.shutdown();
      service = null;
    }
  }

  function startClient(nh) {
    client = nh.serviceClient(SERVICE, SRV);
    return client;
  }

  function stopClient() {
    if (client) {
      client.shutdown();
      client = null;
    }
  }

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

  beforeEach(function () {
    var pubInfo = null;
    var subInfo = null;
    var serviceInfo = null;

    masterStub.on('getUri', function (err, params, callback) {
      var resp = [1, '', 'localhost:11311/'];
      callback(null, resp);
    });

    masterStub.on('registerSubscriber', function (err, params, callback) {
      subInfo = params[3];
      // console.log('sub reg ' + params);
      //console.log(pubInfo);

      var resp = [1, 'You did it!', []];
      if (pubInfo) {
        resp[2].push(pubInfo);
      }
      callback(null, resp);
    });

    masterStub.on('unregisterSubscriber', function (err, params, callback) {
      // console.log('unregister subscriber!');
      var resp = [1, 'You did it!', subInfo ? 1 : 0];
      callback(null, resp);
      subInfo = null;
    });

    masterStub.on('registerPublisher', function (err, params, callback) {
      // console.log('pub reg ' + Date.now());
      pubInfo = params[3];
      var resp = [1, 'You did it!', []];
      if (subInfo) {
        resp[2].push(pubInfo);
        var subAddrParts = subInfo.replace('http://', '').split(':');
        var _client = xmlrpc.createClient({ host: subAddrParts[0], port: subAddrParts[1] });
        var data = [1, TOPIC, [pubInfo]];
        _client.methodCall('publisherUpdate', data, function (err, response) {});
      }
      callback(null, resp);
    });

    masterStub.on('unregisterPublisher', function (err, params, callback) {
      // console.log('pub unreg ' + Date.now());
      var resp = [1, 'You did it!', pubInfo ? 1 : 0];
      callback(null, resp);
      if (subInfo) {
        var subAddrParts = subInfo.replace('http://', '').split(':');
        var _client2 = xmlrpc.createClient({ host: subAddrParts[0], port: subAddrParts[1] });
        var data = [1, TOPIC, []];
        _client2.methodCall('publisherUpdate', data, function (err, response) {});
      }
      pubInfo = null;
    });

    masterStub.on('registerService', function (err, params, callback) {
      serviceInfo = params[2];

      var resp = [1, 'You did it!', []];
      callback(null, resp);
    });

    masterStub.on('unregisterService', function (err, params, callback) {
      var resp = [1, 'You did it!', subInfo ? 1 : 0];
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

    masterStub.on('NotFound', function (method, params) {
      console.error('Got unknown method call %s: %j', method, params);
    });

    return rosnodejs.initNode('/my_node', { rosMasterUri: 'http://localhost:' + MASTER_PORT, logging: { testing: true } });
  });

  afterEach(function () {
    sub = null;
    pub = null;
    service = null;
    client = null;

    clearInterval(interval1);
    clearInterval(interval2);
    clearInterval(interval3);

    var nh = rosnodejs.nh;

    // clear out any service, subs, pubs
    nh._node._services = {};
    nh._node._subscribers = {};
    nh._node._publishers = {};

    // remove any master api handlers we set up
    masterStub.removeAllListeners();
  });

  it('Subscriber Shutdown', function (done) {
    var nh = rosnodejs.nh;
    var pub = startPub(nh);

    var msg = { data: 'This shouldn\'t crash' };

    interval1 = setInterval(function () {
      pub.publish(msg);
    }, 3);

    interval2 = setInterval(function () {
      if (sub === null) {
        startSub(nh);
      } else {
        stopSub();
      }
    }, 10);

    setTimeout(done, 8000);
  });

  it('Publisher Shutdown', function (done) {
    var nh = rosnodejs.nh;
    startSub(nh);

    var msg = { data: 'This shouldn\'t crash' };

    interval1 = setInterval(function () {
      if (pub) {
        pub.publish(msg, -1);
      }
    }, 3);

    interval2 = setInterval(function () {
      if (pub === null) {
        startPub(nh);
      } else {
        stopPub();
      }
    }, 10);

    setTimeout(done, 8000);
  });

  it('Pub Sub Shutdown', function (done) {
    var nh = rosnodejs.nh;

    var msg = { data: 'This shouldn\'t crash' };

    interval1 = setInterval(function () {
      if (pub) {
        pub.publish(msg);
      }
    }, 3);

    interval2 = setInterval(function () {
      if (pub === null) {
        startPub(nh);
      } else {
        stopPub();
      }
    }, 10);

    interval3 = setInterval(function () {
      if (sub === null) {
        startSub(nh);
      } else {
        stopSub();
      }
    }, 7);

    setTimeout(done, 8000);
  });

  it('Service Shutdown', function (done) {
    var nh = rosnodejs.nh;
    var client = startClient(nh);

    var req = {};

    interval1 = setInterval(function () {
      client.call(req);
    }, 3);

    interval2 = setInterval(function () {
      if (service === null) {
        startService(nh);
      } else {
        stopService();
      }
    }, 10);

    setTimeout(done, 8000);
  });

  it('Client Shutdown', function (done) {
    var nh = rosnodejs.nh;
    startService(nh);

    var req = {};

    interval1 = setInterval(function () {
      if (client) {
        client.call(req);
      }
    }, 1);

    interval2 = setInterval(function () {
      if (client === null) {
        startClient(nh);
      } else {
        stopClient();
      }
    }, 10);

    setTimeout(done, 8000);
  });

  it('Client Service Shutdown', function (done) {
    var nh = rosnodejs.nh;

    var req = {};

    interval1 = setInterval(function () {
      if (client) {
        client.call(req);
      }
    }, 1);

    interval2 = setInterval(function () {
      if (client === null) {
        startClient(nh);
      } else {
        stopClient();
      }
    }, 10);

    interval3 = setInterval(function () {
      if (service === null) {
        startService(nh);
      } else {
        stopService();
      }
    }, 7);

    setTimeout(done, 8000);
  });
});