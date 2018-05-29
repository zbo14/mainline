'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const { createSocket } = require('dgram');
const RoutingTable     = require('../lib/routingtable');
const Contact          = require('../lib/contact');
const Id               = require('../lib/id');
const fixtures         = require('./fixtures');

const socket = createSocket('udp4');
socket.bind( 2000 );

const id = Id.random();
const routingTable = new RoutingTable();
const contacts = fixtures.replicate( ( _, i ) => {
  const contact = new Contact({
    host: 'localhost',
    port: 7000 + i
  });
  contact.socket = createSocket('udp4');
  contact.socket.on( 'message', msg => {
    msg = fixtures.parse( msg );
    socket.emit( `${contact.base64}:${msg.tx}` );
  });
  contact.socket.bind( contact.port );
  return contact;
}, 32 );

const checkNumBuckets = numBuckets => {
  it( 'checks the number of buckets in routing table', () => {
    assert.equal( routingTable.buckets.length, numBuckets );
  });
};

const addAllContacts = () => {
  it( 'tries to add contacts to routing table', done => {
    let count = 0;
    for ( let i = 0; i < contacts.length; i++ ) {
      routingTable.addContact( contacts[ i ], id, socket, () => {
        if ( ++count === contacts.length ) {
          done();
        }
      });
    }
  });
};

const addContact = i => {
  it( 'adds contact to routing table', done => {
    routingTable.addContact( contacts[ i ], id, socket, added => {
      assert( added );
      done();
    });
  }).timeout( 5000 );
};

const addContacts = ( start, end ) => {
  for ( let i = start; i < end; i++ ) {
    addContact( i );
  }
};

const stopContact = i => {
  it( 'stops contact listening on socket', () => {
    contacts[ i ].socket.removeAllListeners('message');
  });
};

const findContact = () => {
  it( 'finds contact in routing table', () => {
    let index = Math.floor( Math.random() * routingTable.buckets.length );
    const bucket = routingTable.buckets[ index ];
    index = Math.floor( Math.random() * bucket.contacts.length );
    const contact = bucket.contacts[ index ];
    const result = routingTable.findNode( contact.id );
    assert( result.equal( contact ) );
  });
};

const findClosest = () => {
  it( 'finds closest contacts in routing table', () => {
    const contact = new Contact({
      host: 'localhost',
      port: 6999
    });
    const closest = routingTable.findNode( contact.id );
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
  addContacts( 0, 8 );
  addContact( 4 );
  stopContact( 1 );
  addContact( 8 );
  checkNumBuckets( 1 );
  addContact( 9 );
  checkNumBuckets( 2 );
  addAllContacts();
  findContact();
  findClosest();
});
