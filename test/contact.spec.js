'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Id               = require('../lib/id');
const fixtures         = require('./fixtures');

const server = fixtures.newServer( 9000 );

const equal = () => {
  it( 'checks that contacts are equal', () => {
    const contact1 = fixtures.newContact( 9000 );
    const contact2 = fixtures.newContact( 9000 );
    assert( contact1.equal( contact2 ) );
  });
};

const notEqual = () => {
  it( 'checks that contacts are not equal', () => {
    const contact1 = fixtures.newContact( 7999 );
    const contact2 = fixtures.newContact( 8000 );
    assert( !contact1.equal( contact2 ) );
  });
};

const compare = () => {
  it( 'compares contacts', () => {
    const contact = fixtures.newContact( 9001 );
    const cmp = server.contact.compare( contact );
    assert( cmp, server.id.compare( contact.id ) );
  });
};

const ping = () => {
  it( 'pings the contact', done => {
    server.once( 'message', msg => {
      msg = fixtures.parse( msg );
      server.emit( `${server.base64}:${msg.tx}`, msg );
    });
    server.contact.ping( server, msg => {
      assert.equal( msg.cmd, 'ping' );
      done();
    });
  });
};

const pingTimeout = () => {
  it( 'pings the contact but times out', done => {
    server.contact.ping( server, () => {
      throw new Error('unexpected reply');
    }, done );
  }).timeout( 3000 );
};

const pong = () => {
  it( 'pongs the contact', done => {
    server.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'pong' );
      done();
    });
    server.contact.pong( server );
  });
};

const find = () => {
  it( 'sends find message to contact', done => {
    const target = Id.random();
    server.once( 'message', msg => {
      msg = fixtures.parse( msg );
      server.emit( `${server.base64}:${msg.tx}`, msg );
    });
    server.contact.find( server, target, msg => {
      assert.equal( msg.cmd, 'find' );
      assert.equal( msg.data, target.base64 );
      done();
    });
  });
};

const findTimeout = () => {
  it( 'sends find message to contact but times out', done => {
    const target = Id.random();
    server.contact.find( server, target, () => {
      throw new Error('unexpected reply');
    }, done );
  }).timeout( 3000 );
};

const foundContact = () => {
  it( 'sends found message to contact with target', done => {
    const contact = fixtures.newContact( 9010 );
    server.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'found' );
      assert.deepStrictEqual( msg.data, {
        host: '127.0.0.1',
        port: 9010
      });
      done();
    });
    server.contact.foundContact( server, contact );
  });
};

const foundClosest = () => {
  it( 'sends found message to contact with closest', done => {
    const closest = [];
    for ( let i = 0; i < 8; i++ ) {
      closest.push( fixtures.newContact( 12000 + i ) );
    }
    server.once( 'message', msg => {
      msg = fixtures.parse( msg );
      assert.equal( msg.cmd, 'found' );
      const expected = closest.map( ({ host, port }) => ({ host, port }) );
      assert.deepStrictEqual( msg.data, expected );
      done();
    });
    server.contact.foundClosest( server, closest );
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
