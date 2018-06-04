'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Bucket           = require('../lib/bucket');
const Contact          = require('../lib/contact');
const Id               = require('../lib/id');
const fixtures         = require('./fixtures');

const bucket = new Bucket();
const server = fixtures.newServer( 9001 );

const buckets = [];
const servers = fixtures.replicate( ( _, i ) => {
  const s = fixtures.newServer( 5000 + i );
  s.on( 'message', msg => {
    msg = fixtures.parse( msg );
    server.emit( `${s.base64}:${msg.tx}` );
  });
  return s;
}, 8 );

const stopServer = index => {
  it( 'stops server', () => {
    servers[ index ].close();
  });
};

const ping = () => {
  it( 'pings contacts in bucket', done => {
    bucket.ping( server, done );
  }).timeout( 5000 );
};

const checkStatuses = statuses => {
  it( 'checks statuses', () => {
    assert.deepStrictEqual( bucket.contacts.map( c => c.status ), statuses );
  });
};

const updateBucket = () => {
  it( 'updates bucket', done => {
    const contact = new Contact({
      host: 'localhost',
      port: 3978
    });
    const c = bucket.contacts.find( c => c.isBad );
    bucket.update( contact, server, added => {
      assert( added );
      assert( !bucket.hasContact( c.id ) );
      assert( bucket.hasContact( contact.id ) );
      done();
    });
  });
};

const addContacts = () => {
  it( 'adds contacts to bucket', () => {
    servers.forEach( ({ contact }) => {
      bucket.addContact( contact );
    });
  });
};

const hasContacts = () => {
  it( 'checks that bucket has contacts', () => {
    servers.forEach( ({ id }) => {
      assert( bucket.hasContact( id ) );
    });
  });
};

const doesNotHaveContacts = () => {
  it( 'checks that bucket does not have contacts', () => {
    servers.forEach( ({ id }) => {
      assert( !bucket.hasContact( id ) );
    });
  });
};

const removeContacts = () => {
  it( 'removes contacts from bucket', () => {
    servers.forEach( ({ id }) => {
      bucket.removeContact( id );
    });
  });
};

const splitBucket = () => {
  it( 'splits the bucket', () => {
    const maxBefore = bucket.max.clone();
    const midBefore = bucket.min.add( bucket.range.halve() );
    const minBefore = bucket.min.clone();
    const rangeBefore = bucket.range.clone();
    const otherBucket = bucket.split();
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
  doesNotHaveContacts();
  ping();
  addContacts();
  hasContacts();
  ping();
  checkStatuses( fixtures.fill( 'good', 8 ) );
  removeContacts();
  doesNotHaveContacts();
  addContacts();
  hasContacts();
  fixtures.wait( 3000 );
  stopServer( 0 );
  ping();
  checkStatuses([
    'questionable',
    ...fixtures.fill( 'good', 7 )
  ]);
  ping();
  checkStatuses([
    'bad',
    ...fixtures.fill( 'good', 7 )
  ]);
  updateBucket();
  checkStatuses( fixtures.fill( 'good', 8 ) );
  splitBuckets();
  checkNumContacts();
  checkRange();
  mergeFail();
  mergeBuckets();
  checkNumContacts();
  checkRange();
});
