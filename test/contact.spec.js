'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Contact          = require('../lib/contact');
const Id               = require('../lib/id');
const { createSocket } = require('dgram');
const fixtures         = require('./fixtures');


const contact1 = new Contact('127.0.0.1:9000');
const socket = createSocket('udp4');

socket.bind( 9000 );

const equal = () => {
  it( 'checks that contacts are equal', () => {
    const contact2 = new Contact({ host: '127.0.0.1', port: 9000 });
    const contact3 = new Contact( Buffer.from([ 127, 0, 0, 1, 35, 40 ]) );
    assert( contact1.equal( contact2 ) );
    assert( contact1.equal( contact3 ) );
    assert( contact2.equal( contact3 ) );
  });
};

const notEqual = () => {
  it( 'checks that contacts are not equal', () => {
    const contact2 = new Contact({ host: '127.0.0.1', port: 9001 });
    const contact3 = new Contact( Buffer.from([ 127, 0, 0, 1, 35, 42 ]) );
    assert( !contact1.equal( contact2 ) );
    assert( !contact1.equal( contact3 ) );
    assert( !contact2.equal( contact3 ) );
  });
};

const compare = () => {
  it( 'compares contacts', () => {
    const contact2 = new Contact({ host: '127.0.0.1', port: 9001 });
    const cmp = contact1.compare( contact2 );
    assert( cmp, contact1.id.compare( contact2.id ) );
  });
};

const ping = () => {
  it( 'pings the contact', done => {
    const id = Id.random();
    socket.once( 'message', msg => {
      msg = fixtures.parse( msg );
      socket.emit( `${contact1.base64}:${msg.tx}`, msg );
    });
    contact1.ping( id, socket, msg => {
      assert.equal( msg.cmd, 'ping' );
      done();
    });
  });
};

const pingTimeout = () => {
  it( 'pings the contact but times out', done => {
    const id = Id.random();
    contact1.ping( id, socket, () => {
      throw new Error('unexpected reply');
    }, done );
  }).timeout( 3000 );
};

const pong = () => {
  it( 'pongs the contact', done => {
    const id = Id.random();
    socket.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'pong' );
      done();
    });
    contact1.pong( id, socket );
  });
};

const find = () => {
  it( 'sends find message to contact', done => {
    const id = Id.random();
    const target = Id.random();
    socket.once( 'message', msg => {
      msg = fixtures.parse( msg );
      socket.emit( `${contact1.base64}:${msg.tx}`, msg );
    });
    contact1.find( id, target, socket, msg => {
      assert.equal( msg.cmd, 'find' );
      assert.equal( msg.data, target.base64 );
      done();
    });
  });
};

const findTimeout = () => {
  it( 'sends find message to contact but times out', done => {
    const id = Id.random();
    const target = Id.random();
    contact1.find( id, target, socket, () => {
      throw new Error('unexpected reply');
    }, done );
  }).timeout( 3000 );
};

const foundContact = () => {
  it( 'sends found message to contact with target', done => {
    const id = Id.random();
    const contact = new Contact('127.0.0.1:9010');
    socket.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'found' );
      assert.equal( msg.data, contact.base64 );
      done();
    });
    contact1.foundContact( id, contact, socket );
  });
};

const foundClosest = () => {
  it( 'sends found message to contact with closest', done => {
    const id = Id.random();
    const closest = [];
    for ( let i = 0; i < 8; i++ ) {
      closest.push( Contact.random() );
    }
    socket.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'found' );
      assert.deepStrictEqual( msg.data, closest.map( ({ base64 }) => base64 ) );
      done();
    });
    contact1.foundClosest( id, closest, socket );
  });
};

describe( 'contact', () => {
  equal();
  notEqual();
  compare();
  ping();
  pong();
  find();
  foundContact();
  foundClosest();
  pingTimeout();
  findTimeout();
});
