'use strict';

var chai = require('chai');
var expect = chai.expect;
var serUtils = require('../utils/serialization_utils.js');
var DeserializeStream = serUtils.DeserializeStream;

describe('DeserializeStream', function () {
  var deserializeStream = new DeserializeStream();

  it('basic', function (done) {
    var len = 20;
    deserializeStream.on('message', function (message) {
      expect(message.length).to.equal(len);

      done();
    });

    var buf = new Buffer(len).fill(0);
    var bufWithLen = serUtils.Serialize(buf);

    deserializeStream.write(bufWithLen);
  });

  it('2 chunks', function (done) {
    var len = 20;
    var iter = 0;
    deserializeStream.on('message', function (message) {
      ++iter;
      expect(message.length).to.equal(len);

      if (iter === 2) {
        done();
      }
    });

    var buf = new Buffer(len).fill(0);
    var bufWithLen = serUtils.Serialize(buf);

    deserializeStream.write(bufWithLen);
    deserializeStream.write(bufWithLen);
  });

  it('split length', function (done) {
    var len = 20;
    var iter = 0;
    deserializeStream.on('message', function (message) {
      ++iter;
      expect(message.length).to.equal(len);

      if (iter === 2) {
        done();
      }
    });

    var buf = new Buffer(len).fill(0);
    var bufWithLen = serUtils.Serialize(buf);

    var doubleBuf = Buffer.concat([bufWithLen, bufWithLen]);
    var bufA = doubleBuf.slice(0, len + 5);
    var bufB = doubleBuf.slice(len + 5);

    deserializeStream.write(bufA);
    deserializeStream.write(bufB);
  });

  describe('service response flag', function () {

    beforeEach(function () {
      deserializeStream.setServiceRespDeserialize();
    });

    it('normal', function (done) {
      var len = 20;
      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === 2) {
          done();
        }
      });

      var buf = new Buffer(len).fill(0);
      var bufWithLen = serUtils.Serialize(buf);
      var okBuf = new Buffer(1).fill(1);

      var doubleBuf = Buffer.concat([okBuf, bufWithLen, okBuf, bufWithLen]);
      var bufA = doubleBuf.slice(0, len + 5);
      var bufB = doubleBuf.slice(len + 5);

      deserializeStream.write(bufA);
      deserializeStream.write(bufB);
    });

    it('improper', function (done) {
      var len = 19;
      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === 2) {
          done();
        }
      });

      var buf = new Buffer(len + 5).fill(0);
      buf[0] = 1;
      buf.writeUInt32LE(19, 1);

      var doubleBuf = Buffer.concat([buf, buf]);
      var bufA = doubleBuf.slice(0, len + 6);
      var bufB = doubleBuf.slice(len + 6);

      deserializeStream.write(bufA);
      deserializeStream.write(bufB);
    });

    afterEach(function () {
      deserializeStream._deserializeServiceResp = false;
    });
  });

  describe('various splits', function () {
    var len = 20;
    var bufData = new Buffer(len).fill(0);
    var serBufData = serUtils.Serialize(bufData);

    var peelEmOff = function peelEmOff(buff, sliceLens) {
      var i = 0;
      while (buff.length > 0) {
        var sliceLen = sliceLens[i++];
        var slice = buff.slice(0, sliceLen);
        deserializeStream.write(slice);
        buff = buff.slice(sliceLen);
      }
    };

    it('1', function (done) {
      var sliceLens = [24, 23, 25];
      var numBufs = sliceLens.length;
      var bufArr = new Array(numBufs).fill(serBufData);
      var bigBuff = Buffer.concat(bufArr);

      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === numBufs) {
          done();
        }
      });

      peelEmOff(bigBuff, sliceLens);
    });

    it('2', function (done) {
      var sliceLens = [18, 26, 28];
      var numBufs = sliceLens.length;
      var bufArr = new Array(numBufs).fill(serBufData);
      var bigBuff = Buffer.concat(bufArr);

      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === numBufs) {
          done();
        }
      });

      peelEmOff(bigBuff, sliceLens);
    });

    it('3', function (done) {
      var sliceLens = [18, 28, 26, 25, 26, 24, 21, 23, 25];
      var numBufs = sliceLens.length;
      var bufArr = new Array(numBufs).fill(serBufData);
      var bigBuff = Buffer.concat(bufArr);

      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === numBufs) {
          done();
        }
      });

      peelEmOff(bigBuff, sliceLens);
    });

    it('4', function (done) {
      var sliceLens = [28, 26, 25, 26, 24, 21, 23, 26, 17];
      var numBufs = sliceLens.length;
      var bufArr = new Array(numBufs).fill(serBufData);
      var bigBuff = Buffer.concat(bufArr);

      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === numBufs) {
          done();
        }
      });

      peelEmOff(bigBuff, sliceLens);
    });

    it('services', function (done) {
      var sliceLens = [28, 26, 25, 26, 24, 21, 23, 26, 17];
      var numBufs = sliceLens.length;
      var len = 19;
      var iter = 0;
      deserializeStream.on('message', function (message) {
        ++iter;
        expect(message.length).to.equal(len);

        if (iter === numBufs) {
          deserializeStream._deserializeServiceResp = false;
          done();
        }
      });

      var buf = new Buffer(len + 5).fill(0);
      buf[0] = 1;
      buf.writeUInt32LE(19, 1);

      var bufArr = new Array(numBufs).fill(buf);
      var bigBuff = Buffer.concat(bufArr);

      deserializeStream.setServiceRespDeserialize();
      peelEmOff(bigBuff, sliceLens);
    });
  });

  // TODO: spend more time writing unit tests and get rid of randomness

  it('random split stream', function (done) {
    var len = 20;
    var bufData = new Buffer(len).fill(0);
    var serBufData = serUtils.Serialize(bufData);

    var numBufs = 10000;
    var bufArr = new Array(numBufs).fill(serBufData);
    var bigBuff = Buffer.concat(bufArr);

    var iter = 0;
    deserializeStream.on('message', function (message) {
      ++iter;
      expect(message.length).to.equal(len);

      if (iter === numBufs) {
        done();
      }
    });

    var rand = function rand() {
      return Math.round(Math.random() * 2 * (len + 4));
    };

    while (bigBuff.length > 0) {
      var pos = Math.min(rand(), bigBuff.length);
      var slice = bigBuff.slice(0, pos);
      deserializeStream.write(slice);
      bigBuff = bigBuff.slice(pos);
    }
  });

  it('random split stream 2', function (done) {
    var len = 20;
    var bufData = new Buffer(len).fill(0);
    var serBufData = serUtils.Serialize(bufData);

    var numBufs = 10000;
    var bufArr = new Array(numBufs).fill(serBufData);
    var bigBuff = Buffer.concat(bufArr);

    var iter = 0;
    deserializeStream.on('message', function (message) {
      ++iter;
      expect(message.length).to.equal(len);

      if (iter === numBufs) {
        done();
      }
    });

    // return a random integer between 20 and 28
    var rand = function rand() {
      return Math.round(Math.random() * 8) + len;
    };

    while (bigBuff.length > 0) {
      var pos = Math.min(rand(), bigBuff.length);
      var slice = bigBuff.slice(0, pos);
      deserializeStream.write(slice);
      bigBuff = bigBuff.slice(pos);
    }
  });

  it('random split services', function (done) {
    var sliceLens = [28, 26, 25, 26, 24, 21, 23, 26, 17];
    var numBufs = 10000;

    var len = 19;
    var iter = 0;
    deserializeStream.on('message', function (message) {
      ++iter;
      expect(message.length).to.equal(len);

      if (iter === numBufs) {
        deserializeStream._deserializeServiceResp = false;
        done();
      }
    });

    var buf = new Buffer(len + 5).fill(0);
    buf[0] = 1;
    buf.writeUInt32LE(19, 1);

    var bufArr = new Array(numBufs).fill(buf);
    var bigBuff = Buffer.concat(bufArr);

    deserializeStream.setServiceRespDeserialize();

    var rand = function rand() {
      return Math.round(Math.random() * 8) + len;
    };

    while (bigBuff.length > 0) {
      var pos = Math.min(rand(), bigBuff.length);
      var slice = bigBuff.slice(0, pos);
      deserializeStream.write(slice);
      bigBuff = bigBuff.slice(pos);
    }
  });

  afterEach(function () {
    deserializeStream.removeAllListeners('message');
  });
});