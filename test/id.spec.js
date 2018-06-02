'use strict';

const assert           = require('assert');
const { describe, it } = require('mocha');
const Id               = require('../lib/id');

let id;

const equal = () => {
  it( 'clones the id and checks that they are equal', () => {
    assert( id.equal( id.clone() ) );
  });

  it( 'creates ids from buffer, string and checks that they are equal', () => {
    const buffer = Buffer.alloc( 20 );
    let string = '';
    let segment;
    for ( let i = 0; i < 20; i++ ) {
      buffer[ i ] = i;
      segment = i.toString( 2 );
      string += '0'.repeat( 8 - segment.length ) + segment;
    }
    const id1 = new Id( buffer );
    const id2 = new Id( string );
    assert( id1.equal( id2 ) );
  });
};

const notEqual = () => {
  it( 'clones the id, changes it, and checks that they are not equal', () => {
    const clone = id.clone();
    const index = Math.floor( Math.random() * clone.bufferLength );
    clone.buffer[ index ]++;
    assert( !id.equal( clone ) );
  });
};

const add = () => {
  it( 'adds and does comparisons', () => {
    const otherId = Id.random();
    const sum = id.add( otherId );
    assert( sum.equal( otherId.add( id ) ) );
    assert.equal( sum.compare( id ), 1 );
    assert.equal( sum.compare( otherId ), 1 );
  });
};

const subtract = () => {
  it( 'subtracts and does comparisons', () => {
    const otherId = Id.random();
    if ( id.compare( otherId ) === 1 ) {
      assert.equal( id.subtract( otherId ).compare( id ), -1 );
    } else {
      assert.equal( otherId.subtract( id ).compare( otherId ), -1 );
    }
  });
};

const minMax = () => {
  it( 'checks min and max', () => {
    const id1 = Id.random();
    const id2 = id1.add( Id.random() );
    assert( Id.min( id1, id2 ).equal( id1 ) );
    assert( Id.max( id1, id2 ).equal( id2 ) );
  });
};

const divideSelf = () => {
  it( 'divides by self', () => {
    const { quotient, remainder } = id.divide( id );
    assert( quotient.equal( Id.one() ) );
    assert( remainder.equal( Id.zero() ) );
  });
};

const divide = () => {
  it( 'divides and checks result', () =>{
    const id1 = new Id('101011');
    const id2 = new Id('1001');
    const { quotient, remainder } = id1.divide( id2 );
    assert( quotient.equal( new Id('100') ) );
    assert( remainder.equal( new Id('111') ) );
  });
};

const multiply = () => {
  it( 'multiplies and does comparisons', () => {
    const id1 = new Id('1010110101');
    const id2 = new Id('1001001');
    const product = id1.multiply( id2 );
    assert( product.equal( id2.multiply( id1 ) ) );
    assert.equal( product.compare( id1 ), 1 );
    assert.equal( product.compare( id2 ), 1 );
  });
};

const multiplyDivide = () => {
  it( 'multiplies, divides, and checks that they are equal', () => {
    const otherId = Id.random( 10 );
    assert( id.multiply( otherId ).divide( otherId ).quotient.equal( id ) );
  });
};

const divideMultiply = () => {
  it( 'divides, multiplies, and checks that they are equal', () => {
    const otherId = Id.random( 10 );
    const { quotient, remainder } = id.divide( otherId );
    assert( quotient.multiply( otherId ).add( remainder ).equal( id ) );
  });
};

const addSubtract = () => {
  it( 'adds, subtracts, and checks that they are equal', () => {
    const otherId = Id.random();
    assert( id.add( otherId ).subtract( otherId ).equal( id ) );
  });
};

const subtractAdd = () => {
  it( 'subtracts, adds, and checks that they are equal', () => {
    const otherId = Id.random();
    if ( id.compare( otherId ) === 1 ) {
      assert( id.subtract( otherId ).add( otherId ).equal( id ) );
    } else {
      assert( otherId.subtract( id ).add( id ).equal( otherId ) );
    }
  });
};

const difference = () => {
  it( 'checks difference', () => {
    const otherId = Id.random();
    const diff = id.difference( otherId );
    if ( id.compare( otherId ) === 1 ) {
      assert( diff.equal( id.subtract( otherId ) ) );
      assert( diff.equal( otherId.difference( id ) ) );
    } else {
      assert( diff.equal( otherId.subtract( id ) ) );
      assert( diff.equal( otherId.difference( id ) ) );
    }
  });
};

const doubleHalve = () => {
  it( 'doubles id then halves it and checks that they are equal', () => {
    assert( id.double().halve( id ).equal( id ) );
  });
};

const halveDouble = () => {
  it( 'halves id then doubles it and checks that they are equal', () => {
    id = id.halve().double();
    assert( id.halve().double().equal( id ) );
  });
};

describe( 'id', () => {
  id = Id.random();
  equal();
  notEqual();
  minMax();
  add();
  subtract();
  divideSelf();
  addSubtract();
  subtractAdd();
  difference();
  doubleHalve();
  halveDouble();
  divide();
  multiply();
  multiplyDivide();
  divideMultiply();
});
