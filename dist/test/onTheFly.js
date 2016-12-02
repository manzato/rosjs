'use strict';

var chai = require('chai');
var expect = chai.expect;
var rosnodejs = require('../index.js');

rosnodejs.initNode('/my_node', { onTheFly: true }).then(function (rosNode) {

  var geometry_msgs = rosnodejs.require('geometry_msgs').msg;
  var msg = new geometry_msgs.PoseWithCovariance({
    pose: {
      position: { x: 0, y: 0, z: 0 },
      orientation: { w: 1, x: 0, y: 0, z: 0 }
    },
    covariance: [0, 0, 0, 0, 0, 0.123, 0, 2, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 8, 0, 0.123, 0, 0, 0, 0, 0.654321654321]
  });

  describe('OnTheFly', function () {

    it('serialize/deserialize', function (done) {
      var size = geometry_msgs.PoseWithCovariance.getMessageSize(msg);
      var buffer = new Buffer(size);
      geometry_msgs.PoseWithCovariance.serialize(msg, buffer, 0);

      var read = geometry_msgs.PoseWithCovariance.deserialize(buffer);
      expect(read.covariance.length == msg.covariance.length && read.covariance.every(function (v, i) {
        return v === msg.covariance[i];
      })).to.be.true;

      done();
    });
  });
});