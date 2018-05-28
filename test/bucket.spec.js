'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const { createSocket } = require('dgram');
const Bucket           = require('../lib/bucket');
const Contact          = require('../lib/contact');
const Id               = require('../lib/id');
const fixtures         = require('./fixtures');

const id = Id.random();
const bucket = new Bucket();
const buckets = [];
let contacts = [];

const socket = createSocket('udp4');
socket.bind( 9001 );

const generateContacts = () => {
  it( 'generates contacts with sockets', () => {
    for ( let i = 0; i < 8; i++ ) {
      const port = 5000 + i;
      const contact = new Contact( `127.0.0.1:${port}` );
      contact.socket = createSocket('udp4');
      contact.socket.on( 'message', msg => {
        msg = fixtures.parse( msg );
        socket.emit( `${contact.base64}:${msg.tx}` );
      });
      contact.socket.bind( port );
      contacts.push( contact );
    }
  });
};

const wait = () => {
  it( 'waits for a bit', done => {
    setTimeout( done, 3000 );
  }).timeout( 4000 );
};

const stopSocket = index => {
  it( 'stops listening on socket', () => {
    contacts[ index ].socket.close();
  });
};

const updateBucket = () => {
  it( 'updates bucket', done => {
    bucket.update( id, socket, done );
  }).timeout( 5000 );
};

const checkStatuses = statuses => {
  it( 'checks statuses', () => {
    assert.deepStrictEqual( contacts.map( c => c.status ), statuses );
  });
};

const replaceContact = () => {
  it( 'replaces contact', () => {
    const contact = Contact.random();
    const c = bucket.contacts.find( c => c.isBad );
    assert( bucket.replaceContact( contact ) );
    assert( !bucket.hasContact( c.id ) );
  });
};

const replaceContactFail = () => {
  it( 'fails to replace contact', () => {
    assert( !bucket.replaceContact( Contact.random() ) );
  });
};

const addContacts = () => {
  it( 'adds contacts to bucket', () => {
    contacts.forEach( contact => {
      bucket.addContact( contact );
    });
    assert( bucket.full );
  });
};

const hasContacts = () => {
  it( 'checks that bucket has contacts', () => {
    contacts.forEach( contact => {
      assert( bucket.hasContact( contact.id ) );
    });
  });
};

const doesNotHaveContacts = () => {
  it( 'checks that bucket does not have contacts', () => {
    contacts.forEach( contact => {
      assert( !bucket.hasContact( contact.id ) );
    });
  });
};

const removeContacts = () => {
  it( 'removes contacts from bucket', () => {
    contacts.forEach( contact => {
      bucket.removeContact( contact.id );
    });
  });
};

const splitBucket = ( contact = null ) => {
  it( 'splits the bucket', () => {
    const maxBefore = bucket.max.clone();
    const midBefore = bucket.min.add( bucket.range.halve() );
    const minBefore = bucket.min.clone();
    const rangeBefore = bucket.range.clone();
    const otherBucket = bucket.split( contact );
    buckets.push( otherBucket );
    assert.equal( bucket.compare( otherBucket ), 1 );
    assert( bucket.max.equal( maxBefore ) );
    assert( bucket.min.equal( midBefore ) );
    assert( otherBucket.range.equal( rangeBefore.halve() ) );
    assert( otherBucket.max.equal( midBefore ) );
    assert( otherBucket.min.equal( minBefore ) );
    assert( otherBucket.range.equal( rangeBefore.halve() ) );
    bucket.contacts.forEach( contact => {
      assert( bucket.belongs( contact.id ) );
      assert( !otherBucket.belongs( contact.id ) );
    });
    otherBucket.contacts.forEach( contact => {
      assert( !bucket.belongs( contact.id ) );
      assert( otherBucket.belongs( contact.id ) );
    });
  });
};

const mergeFail = () => {
  it( 'fails to merge buckets', () => {
    const bucket1 = buckets.shift();
    const bucket2 = buckets.shift();
    const bucket3 = buckets.shift();
    assert( !bucket1.merge( bucket3 ) );
    assert( !bucket3.merge( bucket1 ) );
    assert( !bucket2.merge( bucket2 ) );
    buckets.unshift( bucket1, bucket2, bucket3 );
  });
};

const mergeBucket = ( flip = false ) => {
  it( 'merges two buckets', () => {
    const bucket1 = buckets.shift();
    const bucket2 = buckets.shift();
    const contacts = bucket1.contacts.concat( bucket2.contacts );
    const min = bucket1.min.clone();
    const max = bucket2.max.clone();
    const range = bucket1.range.add( bucket2.range );
    let bucket;
    if ( flip ) {
      assert( bucket2.merge( bucket1 ) );
      bucket = bucket2;
    } else {
      assert( bucket1.merge( bucket2 ) );
      bucket = bucket1;
    }
    assert( bucket.max.equal( max ) );
    assert( bucket.min.equal( min ) );
    assert.deepStrictEqual( bucket.range, range );
    contacts.forEach( ({ id }) => {
      assert( bucket.hasContact( id ) );
    });
    buckets.unshift( bucket );
  });
};

const mergeBuckets = ( times = 4 ) => {
  let flip = false;
  for ( let i = 0; i < times; i++ ) {
    mergeBucket( flip );
    flip = !flip;
  }
};

const splitBuckets = ( times = 8 ) => {
  for ( let i = 0; i < times; i++ ) {
    splitBucket();
  }
};

const checkNumContacts = ( numContacts = 8 ) => {
  it( 'checks total number of contacts', () => {
    const contacts = bucket.contacts.slice( 0 );
    buckets.forEach( b => {
      contacts.push( ...b.contacts );
    });
    assert.equal( contacts.length, numContacts );
  });
};

const checkRange = () => {
  it( 'checks the cumulative range of the buckets', () => {
    let result = bucket.range.clone();
    buckets.forEach( b => {
      result = result.add( b.range );
    });
    assert( result.equal( Id.range() ) );
  });
};

describe( 'bucket', () => {
  generateContacts();
  doesNotHaveContacts();
  updateBucket();
  addContacts();
  hasContacts();
  updateBucket();
  checkStatuses( Array( 8 ).fill('good') );
  removeContacts();
  doesNotHaveContacts();
  addContacts();
  hasContacts();
  wait();
  stopSocket( 0 );
  updateBucket();
  checkStatuses([ 'questionable', ...Array( 7 ).fill('good') ]);
  updateBucket();
  checkStatuses([ 'bad', ...Array( 7 ).fill('good') ]);
  replaceContact();
  replaceContactFail();
  splitBuckets();
  checkNumContacts();
  checkRange();
  mergeFail();
  mergeBuckets();
  checkNumContacts();
  checkRange();
});
