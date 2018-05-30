'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Contact          = require('../lib/contact');
const Server           = require('../lib/server');
const fixtures         = require('./fixtures');

const host = '127.0.0.1';
const server = new Server({ host, port: 9987 });
const servers = fixtures.replicate( ( _, i ) => {
  return new Server({ host, port: 8000 + i });
}, 32 );

const checkNumBuckets = numBuckets => {
  it( 'checks the number of buckets', () => {
    assert.equal( server.routingTable.buckets.length, numBuckets );
  });
};

const update = i => {
  it( 'updates server\'s routing table', done => {
    const contact = servers[ i ].contact;
    server.update( contact, added => {
      assert( added );
      server.hasContact( contact.id );
      done();
    });
  }).timeout( 5000 );
};

const ping = i => {
  it( 'pings a contact', done => {
    const contact = servers[ i ].contact;
    server.ping( contact, done );
  });
};

const findContact = ( i, j ) => {
  it( 'finds contact in server\'s routing table', done => {
    const contact = server.contact;
    const target = servers[ j ].id;
    servers[ i ].find( contact, target, result =>  {
      assert( result instanceof Contact );
      assert( result.equal( servers[ j ].contact ) );
      done();
    });
  });
};

const findClosest = ( i, j ) => {
  it( 'finds closest in server\'s routing table', done => {
    const contact = server.contact;
    const target = servers[ j ].id;
    servers[ i ].find( contact, target, result => {
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

const updates = ( start, end ) => {
  for ( let i = start; i < end; i++ ) {
    update( i );
  }
};

const pings = ( start, end ) => {
  for ( let i = start; i < end; i++ ) {
    ping( i );
  }
};

describe( 'server', () => {
  checkNumBuckets( 1 );
  updates( 0, 8 );
  checkNumBuckets( 1 );
  update( 9 );
  checkNumBuckets( 2 );
  pings( 0, 9 );
  findContact( 1, 2 );
  findClosest( 1, 11 );
});
