'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const RoutingTable     = require('../lib/routingtable');
const Contact          = require('../lib/contact');
const fixtures         = require('./fixtures');

const routingTable = new RoutingTable();
const server = fixtures.newServer( 2000 );

const servers = fixtures.replicate( ( _, i ) => {
  const s = fixtures.newServer( 7000 + i );
  s.on( 'message', msg => {
    msg = fixtures.parse( msg );
    server.emit( `${s.base64}:${msg.tx}` );
  });
  return s;
}, 32 );

const checkNumBuckets = numBuckets => {
  it( 'checks the number of buckets in routing table', () => {
    assert.equal( routingTable.buckets.length, numBuckets );
  });
};

const updateAll = () => {
  it( 'tries to update routing table with all contacts', done => {
    let count = 0;
    for ( let i = 0; i < servers.length; i++ ) {
      routingTable.update( servers[ i ].contact, server, () => {
        if ( ++count === servers.length ) {
          done();
        }
      });
    }
  });
};

const update = i => {
  it( 'updates routing table', done => {
    routingTable.update( servers[ i ].contact, server, added => {
      assert( added );
      done();
    });
  }).timeout( 5000 );
};

const updates = ( start, end ) => {
  for ( let i = start; i < end; i++ ) {
    update( i );
  }
};

const stopServer = i => {
  it( 'stops server', () => {
    servers[ i ].close();
  });
};

const findContact = () => {
  it( 'finds contact in routing table', () => {
    let index = Math.floor( Math.random() * routingTable.buckets.length );
    const bucket = routingTable.buckets[ index ];
    index = Math.floor( Math.random() * bucket.contacts.length );
    const contact = bucket.contacts[ index ];
    const result = routingTable.find( contact.id );
    assert( result.equal( contact ) );
  });
};

const findClosest = () => {
  it( 'finds closest contacts in routing table', () => {
    const contact = new Contact({
      host: 'localhost',
      port: 6999
    });
    const closest = routingTable.find( contact.id );
    const contacts = routingTable.contacts;
    contacts.sort( ( a, b ) => {
      const diff1 = a.id.difference( contact.id );
      const diff2 = b.id.difference( contact.id );
      return diff1.compare( diff2 );
    });
    assert.deepStrictEqual( closest, contacts.slice( 0, 8 ) );
  });
};

describe( 'routing table', () => {
  checkNumBuckets( 1 );
  updates( 0, 8 );
  update( 4 );
  stopServer( 1 );
  update( 8 );
  checkNumBuckets( 1 );
  update( 9 );
  checkNumBuckets( 2 );
  updateAll();
  findContact();
  findClosest();
});
