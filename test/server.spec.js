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

const findContact = ({ server, target }) => {
  it( 'finds contact in server\'s routing table', done => {
    server = servers[ server ];
    target = servers[ target ].id;
    server.find( target, result =>  {
      if ( result instanceof Array ) {
        assert.equal( result.length, 0 );
        server.contacts.forEach( c => {
          const diff1 = server.id.difference( target );
          const diff2 = c.id.difference( target );
          assert.equal( diff1.compare( diff2 ), -1 );
        });
        return done();
      }
      assert( result instanceof Contact );
      assert( result.id.equal( target ) );
      done();
    });
  });
};

const findClosest = ({ server, target }) => {
  it( 'finds closest in server\'s routing table', done => {
    server = servers[ server ];
    target = servers[ target ].id;
    server.find( target, result => {
      assert( result instanceof Array );
      if ( result.length === 0 ) {
        server.contacts.forEach( c => {
          const diff1 = server.id.difference( target );
          const diff2 = c.id.difference( target );
          assert.equal( diff1.compare( diff2 ), -1 );
        });
        return done();
      }
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
  fixtures.wait( 3000 );
  ping({ server: 0, contact: 8 });
  fixtures.wait( 6000 );
  hasContact({ server: 0, contact: 8 });
  doesNotHaveContact({ server: 0, contact: 7 });
  checkNumBuckets({ server: 0, numBuckets: 1 });
  ping({ server: 0, contact: 9 });
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
});
