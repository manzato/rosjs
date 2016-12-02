'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var chai = require('chai');
var expect = chai.expect;
var Spinner = require('../utils/GlobalSpinner.js');

var handleList = [];
var spinner = void 0;

var DummyClient = function () {
  function DummyClient() {
    _classCallCheck(this, DummyClient);

    this.id = 'xxxxxxxx'.replace(/[x]/g, function (c) {
      return (Math.random() * 8).toString(16);
    });
  }

  _createClass(DummyClient, [{
    key: '_handleMsgQueue',
    value: function _handleMsgQueue(queue) {
      handleList.push({ id: this.id, queue: queue });
    }
  }]);

  return DummyClient;
}();

describe('Spinner', function () {

  beforeEach(function () {
    spinner = new Spinner(null, true);
    handleList = [];
  });

  it('Ping', function (done) {
    var clients = [new DummyClient(), new DummyClient(), new DummyClient(), new DummyClient()];

    clients.forEach(function (client) {
      spinner.addClient(client, client.id, 3, 0);
    });

    spinner.ping(clients[0].id, "junk");
    expect(spinner._spinTimer).to.not.be.null;

    spinner.ping(clients[3].id, "junk");
    spinner.ping(clients[2].id, "junk");
    spinner.ping(clients[1].id, "junk");

    expect(spinner._clientCallQueue.length).to.equal(4);

    spinner.disconnect(clients[3].id);

    expect(spinner._clientCallQueue.length).to.equal(3);

    spinner.once('tick', function () {
      expect(handleList.length).to.equal(3);
      expect(handleList[0].id).to.equal(clients[0].id);
      expect(handleList[1].id).to.equal(clients[2].id);
      expect(handleList[2].id).to.equal(clients[1].id);

      done();
    });
  });

  it('QueueSize', function (done) {
    var client = new DummyClient();

    var messages = ["a", "b", "c", "d", "e"];

    spinner.addClient(client, client.id, 3, 0);

    messages.forEach(function (message) {
      spinner.ping(client.id, message);
    });

    spinner.once('tick', function () {
      expect(handleList.length).to.equal(1);
      var handledQueue = handleList[0].queue;
      expect(handledQueue.length).to.equal(3);
      expect(handledQueue[0]).to.equal(messages[2]);
      expect(handledQueue[1]).to.equal(messages[3]);
      expect(handledQueue[2]).to.equal(messages[4]);

      done();
    });
  });

  it('Locking', function (done) {
    var client = new DummyClient();

    spinner.addClient(client, client.id, 3, 0);

    spinner.ping(client.id, 'junk');

    // lock the queue so that the next ping is cached
    spinner._queueLocked = true;

    spinner.ping(client.id, 'junk');

    expect(spinner._lockedOpCache.length).to.equal(1);

    spinner.once('tick', function () {
      expect(handleList.length).to.equal(1);
      expect(handleList[0].queue.length).to.equal(1);
      expect(spinner._lockedOpCache.length).to.equal(0);
      expect(spinner._clientCallQueue.length).to.equal(1);
      expect(spinner._spinTimer).to.not.be.null;
      handleList = [];

      spinner.once('tick', function () {
        expect(handleList.length).to.equal(1);
        expect(handleList[0].queue.length).to.equal(1);
        expect(spinner._lockedOpCache.length).to.equal(0);
        expect(spinner._clientCallQueue.length).to.equal(0);
        handleList = [];

        spinner.ping(client.id, 'junk');

        // lock the queue so the next disconnect is cached
        spinner._queueLocked = true;

        spinner.disconnect(client.id);
        expect(spinner._lockedOpCache.length).to.equal(1);

        spinner.once('tick', function () {
          expect(handleList.length).to.equal(1);
          expect(handleList[0].queue.length).to.equal(1);
          expect(spinner._lockedOpCache.length).to.equal(0);
          expect(spinner._clientCallQueue.length).to.equal(0);
          expect(spinner._clientQueueMap.has(client.id)).to.be.false;

          done();
        });
      });
    });
  });

  it('Throttling', function (done) {
    var client = new DummyClient();

    var throttleMs = 100;
    spinner.addClient(client, client.id, 1, throttleMs);

    spinner.ping(client.id, "junk");
    spinner.once('tick', function () {
      var firstTick = Date.now();
      spinner.ping(client.id, "junk");

      spinner.on('tick', function () {
        if (spinner._clientCallQueue.length === 0) {
          var lastTick = Date.now();
          var tDiff = lastTick - firstTick;
          expect(tDiff).to.be.at.least(throttleMs);

          done();
        }
      });
    });
  });
});