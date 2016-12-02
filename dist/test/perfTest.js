'use strict';

/**
 * Quick test for serialization, deserialization Performance
 */

var expect = require('chai').expect;
var rosnodejs = require('../index.js');
var TfStamped = rosnodejs.require('geometry_msgs').msg.TransformStamped;
var TfMessage = rosnodejs.require('tf2_msgs').msg.TFMessage;
var Image = rosnodejs.require('sensor_msgs').msg.Image;
var Header = rosnodejs.require('std_msgs').msg.Header;

var header = new Header({ seq: 100, stamp: { secs: 20, nsecs: 100010 }, frame_id: 'test_cam' });

function getSeconds(hrTime) {
  return hrTime[0] + hrTime[1] / 1e9;
}

function getMB(bytes) {
  return bytes / 1e6;
}

function getBandwidth(bytes, hrTime) {
  return (getMB(bytes) / getSeconds(hrTime)).toFixed(3);
}

var NUM_CYCLES = 100;

var hrTime = void 0;
var deltaT = void 0;

console.log('=== Serialization Performance Test ===');
console.log(' ==');
console.log(' == Image Test');
console.log(' == Cycles: %d', NUM_CYCLES);
console.log(' ==');

var image = void 0;
console.time('Create Image');
var width = 1280,
    height = 800,
    step = width * 3;
for (var i = 0; i < NUM_CYCLES; ++i) {
  image = new Image({
    width: width,
    height: height,
    encoding: 'bgr8',
    step: step,
    data: Buffer.allocUnsafe(step * height),
    header: header
  });
}
console.timeEnd('Create Image');

var bytesPerCycle = void 0;
var bufsize = void 0;
console.time('Determine Message Size');
for (var _i = 0; _i < NUM_CYCLES; ++_i) {
  bufsize = Image.getMessageSize(image);
}
console.timeEnd('Determine Message Size');
bytesPerCycle = bufsize * NUM_CYCLES;

console.log('Buffer size: %d', bufsize);

console.time('allocate buffer');
var buffer = void 0;
for (var _i2 = 0; _i2 < NUM_CYCLES; ++_i2) {
  buffer = new Buffer(bufsize);
}
console.timeEnd('allocate buffer');

console.time('Serialize');
hrTime = process.hrtime();
for (var _i3 = 0; _i3 < NUM_CYCLES; ++_i3) {
  Image.serialize(image, buffer, 0);
}
deltaT = process.hrtime(hrTime);
console.timeEnd('Serialize');
console.log('Serialized BW: ' + getBandwidth(bytesPerCycle, deltaT) + 'MB');

console.time('Deserialize');
var deserialized = void 0;
hrTime = process.hrtime();
for (var _i4 = 0; _i4 < NUM_CYCLES; ++_i4) {
  deserialized = Image.deserialize(buffer, [0]);
}
deltaT = process.hrtime(hrTime);
console.timeEnd('Deserialize');
console.log('Deserialized BW: ' + getBandwidth(bytesPerCycle, deltaT) + 'MB');

// verify equality!
expect(deserialized).to.deep.equal(image);

var NUM_TFS = 1000;

console.log(' ==');
console.log(' == TF Test');
console.log(' == Cycles: %d', NUM_CYCLES);
console.log(' == # of Transforms: %d', NUM_TFS);
console.log(' ==');

var tfStamped = new TfStamped();
tfStamped.header.frame_id = 'test_parent_frame';
tfStamped.child_frame_id = 'test_frame';

console.time('Create TfMessage');
var tfMessage = void 0;
for (var _i5 = 0; _i5 < NUM_CYCLES; ++_i5) {
  tfMessage = new TfMessage();
  for (var j = 0; j < NUM_TFS; ++j) {
    var tf = new TfStamped(tfStamped);
    tfMessage.transforms.push(tf);
  }
}
console.timeEnd('Create TfMessage');

console.time('Determine Message Size');
for (var _i6 = 0; _i6 < NUM_CYCLES; ++_i6) {
  bufsize = TfMessage.getMessageSize(tfMessage);
}
console.timeEnd('Determine Message Size');
bytesPerCycle = bufsize * NUM_CYCLES;

console.log('Buffer size: %d', bufsize);

console.time('Allocate buffer');
for (var _i7 = 0; _i7 < NUM_CYCLES; ++_i7) {
  buffer = new Buffer(bufsize);
}
console.timeEnd('Allocate buffer');

console.time('Serialize');
hrTime = process.hrtime();
for (var _i8 = 0; _i8 < NUM_CYCLES; ++_i8) {
  TfMessage.serialize(tfMessage, buffer, 0);
}
deltaT = process.hrtime(hrTime);
console.timeEnd('Serialize');
console.log('Serialized BW: ' + getBandwidth(bytesPerCycle, deltaT) + 'MB');

console.time('Deserialize');
hrTime = process.hrtime();
for (var _i9 = 0; _i9 < NUM_CYCLES; ++_i9) {
  deserialized = TfMessage.deserialize(buffer, [0]);
}
deltaT = process.hrtime(hrTime);
console.timeEnd('Deserialize');
console.log('Deserialized BW: ' + getBandwidth(bytesPerCycle, deltaT) + 'MB');

// verify equality!
expect(deserialized).to.deep.equal(tfMessage);