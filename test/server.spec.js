'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Contact          = require('../lib/contact');
const Server           = require('../lib/server');
const fixtures         = require('./fixtures');

const servers = fixtures.replicate( ( _, i ) => {
  return new Server({
    host: '127.0.0.1',
    port: 8000 + i
  });
}, 32 );

const startServer = i => {
  it( 'starts server', () => {
    servers[ i ].start();
  });
};

const stopServer = i => {
  it( 'stops server', () => {
    servers[ i ].stop();
  });
};

const startServers = () => {
  it( 'starts servers', () => {
    servers.forEach( server => server.start() );
  });
};

const checkNumBuckets = ({ server, numBuckets }) => {
  it( 'checks the number of buckets', () => {
    server = servers[ server ];
    assert.equal( server.routingTable.buckets.length, numBuckets );
  });
};

const hasContact = ({ server, contact }) => {
  it( 'checks that server has contact', () => {
    const id = servers[ contact ].id;
    server = servers[ server ];
    assert( server.hasContact( id ) );
  });
};

const doesNotHaveContact = ({ server, contact }) => {
  it( 'checks that server does not have contact', () => {
    const id = servers[ contact ].id;
    server = servers[ server ];
    assert( !server.hasContact( id ) );
  });
};

const ping = ({ server, contact, success = true }) => {
  it( 'has server ping contact', done => {
    contact = servers[ contact ].contact;
    server = servers[ server ];
    server.ping( contact, result => {
      assert.equal( !!result, success );
      done();
    });
  }).timeout( 3000 );
};

const pingUpdate = ({ server, contact }) => {
  it( 'has server ping contact and wait for update', done => {
    contact = servers[ contact ].contact;
    server = servers[ server ];
    server.once( `update:${contact.base64}`, done );
    server.ping( contact, result => assert( result ) );
  }).timeout( 3000 );
};

const findContact = ({ server, target }) => {
  it( 'has server find contact', done => {
    server = servers[ server ];
    target = servers[ target ].id;
    server.iterfind( target, result =>  {
      assert( result instanceof Contact );
      assert( result.id.equal( target ) );
      done();
    });
  });
};

const findClosest = ({ server, target }) => {
  it( 'has server find closest contacts', done => {
    server = servers[ server ];
    target = servers[ target ].id;
    server.iterfind( target, result => {
      assert( result instanceof Array );
      const closest = server.routingTable.contacts;
      closest.sort( ( a, b ) => {
        const diff1 = a.id.difference( target );
        const diff2 = b.id.difference( target );
        return diff1.compare( diff2 );
      });
      closest.slice( 0, 8 ).forEach( ( c, i ) => {
        c.equal( result[ i ]);
      });
      done();
    });
  });
};

describe( 'server', () => {
  startServers();
  checkNumBuckets({ server: 0, numBuckets: 1 });
  for ( let i = 0; i < 8; i++ ) {
    ping({ server: 0, contact: i });
    hasContact({ server: 0, contact: i });
    hasContact({ server: i, contact: 0 });
  }
  stopServer( 7 );
  fixtures.wait( Contact.idleTimeout );
  ping({ server: 0, contact: 8 });
  fixtures.wait( Contact.idleTimeout * 2 );
  hasContact({ server: 0, contact: 8 });
  doesNotHaveContact({ server: 0, contact: 7 });
  checkNumBuckets({ server: 0, numBuckets: 1 });
  pingUpdate({ server: 0, contact: 9 });
  checkNumBuckets({ server: 0, numBuckets: 2 });
  findContact({ server: 0, target: 2 });
  findClosest({ server: 1, target: 11 });
  findClosest({ server: 2, target: 12 });
  findClosest({ server: 5, target: 15 });
  findContact({ server: 3, target: 4 });
  findContact({ server: 5, target: 6 });
  stopServer( 4 );
  ping({ server: 9, contact: 4, success: false });
  startServer( 4 );
  ping({ server: 3,  contact: 4 });
  findClosest({ server: 29, target: 30 });
  doesNotHaveContact({ server: 29, contact: 30 });
  pingUpdate({ server: 29, contact: 2 });
  findContact({ server: 29, target: 3 });
  pingUpdate({ server: 28, contact: 29 });
  findContact({ server: 28, target: 6 });
  findClosest({ server: 28, target: 7 });
});
