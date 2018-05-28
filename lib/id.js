'use strict';

const { randomBytes } = require('crypto');

class Id {
  /**
   * constructor
   * @param {(Buffer|string)} id
   */
  constructor( id ) {
    if ( Buffer.isBuffer( id ) ) {
      this.fromBuffer( id );
    } else if ( typeof id === 'string' ) {
      this.fromBinary( id );
    }
    this.base64 = this.buffer.toString('base64');
  }

  fromBinary( binary ) {
    this.binary = binary;
    this.unpadBinary();
    const mod = this.binaryLength % 8;
    if ( mod > 0 ) {
      this.padBinary( 8 - mod );
    }
    const bufferLength = this.binaryLength / 8;
    this.buffer = Buffer.alloc( bufferLength );
    for ( let i = 0; i < bufferLength; i++ ) {
      this.buffer[ i ] = parseInt(
        this.binary.slice( i * 8, ( i + 1 ) * 8 ), 2
      );
    }
  }

  fromBuffer( buffer ) {
    this.buffer = buffer;
    this.unpadBuffer();
    this.binary = '';
    this.buffer.forEach( v => {
      const binary = ( v >>> 0 ).toString( 2 );
      this.binary += '0'.repeat( 8 - binary.length ) + binary;
    });
  }

  reverseBinary() {
    this.binary = this.binary.split('').reverse().join('');
  }

  /**
   * @return {Id}
   */
  static zero() {
    return new Id('0');
  }

  /**
   * @param  {number} [bufferLength=20]
   * @return {Id}
   */
  static random( bufferLength = 20 ) {
    return new Id( randomBytes( bufferLength ) );
  }

  /**
   * @param  {Id} a
   * @param  {Id} b
   * @return {Id}
   */
  static max( a, b ) {
    if ( a.compare( b ) === 1 ) {
      return a;
    }
    return b;
  }

  /**
   * @param  {Id} a
   * @param  {Id} b
   * @return {Id}
   */
  static min( a, b ) {
    if ( a.compare( b ) === -1 ) {
      return a;
    }
    return b;
  }

  /**
   * @return {Id}
   */
  static one() {
    return new Id('1');
  }

  /**
   * @return {Id}
   */
  static range() {
    const buffer = Buffer.alloc( 21 );
    buffer[ 0 ] = 1;
    return new Id( buffer );
  }

  /**
   * @return {number}
   */
  get bufferLength() {
    return this.buffer.length;
  }

  /**
   * @return {number}
   */
  get binaryLength() {
    return this.binary.length;
  }

  /**
   * @return {Id}
   */
  clone() {
    const buffer = Buffer.alloc( this.bufferLength );
    this.buffer.copy( buffer );
    return new Id( buffer );
  }

  unpadBuffer() {
    for ( let i = 0; i < this.bufferLength; i++ ) {
      if ( this.buffer[ i ] > 0 ) {
        this.buffer = this.buffer.slice( i );
        return;
      }
    }
    this.buffer = Buffer.from([ 0 ]);
  }

  padBinary( padding ) {
    if ( padding > 0 ) {
      this.binary = '0'.repeat( padding ) + this.binary;
    }
  }

  unpadBinary() {
    for ( let i = 0; i < this.binaryLength; i++ ) {
      if ( this.binary[ i ] === '1' ) {
        this.binary = this.binary.slice( i );
        return;
      }
    }
    this.binary = '0'.repeat( 8 );
  }

  /**
   * @param  {Id}       id
   * @return {number}
   */
  compare( id ) {
    if ( this.bufferLength > id.bufferLength ) {
      return 1;
    }
    if ( this.bufferLength < id.bufferLength ) {
      return -1;
    }
    for ( let i = 0; i < this.bufferLength; i++ ) {
      if ( this.buffer[ i ] > id.buffer[ i ] ) {
        return 1;
      }
      if ( this.buffer[ i ] < id.buffer[ i ] ) {
        return -1;
      }
    }
    return 0;
  }

  /**
   * @param  {Id}       id
   * @return {boolean}
   */
  equal( id ) {
    return this.compare( id ) === 0;
  }

  /**
   * @param  {Id}     id
   * @return {number}
   */
  difference( id ) {
    if ( this.compare( id ) === 1 ) {
      return this.subtract( id );
    }
    return id.subtract( this );
  }

  /**
   * @return {Id}
   */
  double() {
    return new Id( this.binary + '0' );
  }

  /**
   * @return {Id}
   */
  halve() {
    return new Id( this.binary.slice( 0, -1 ) );
  }

  /**
   * @param  {Id} id
   * @return {Id}
   */
  add( id ) {
    const padding = this.binaryLength - id.binaryLength;
    if ( padding > 0 ) {
      id.padBinary( padding );
    } else if ( padding < 0 ) {
      this.padBinary( -padding );
    }
    this.reverseBinary();
    id.reverseBinary();
    const arr = [];
    let carry = false;
    let x;
    let y;
    for ( let i = 0; i < this.binaryLength; i++ ) {
      x = this.binary[ i ];
      y = id.binary[ i ];
      if ( x === '1' && y === '1' ) {
        if ( carry ) {
          arr.unshift('1');
        } else {
          arr.unshift('0');
          carry = true;
        }
      } else if ( x === '0' && y === '0' ) {
        if ( carry ) {
          arr.unshift('1');
          carry = false;
        } else {
          arr.unshift('0');
        }
      } else {
        if ( carry ) {
          arr.unshift('0');
        } else {
          arr.unshift('1');
        }
      }
    }
    if ( carry ) {
      arr.unshift('1');
    }
    this.reverseBinary();
    id.reverseBinary();
    return new Id( arr.join('') );
  }

  /**
   * @param  {Id} id
   * @return {Id}
   */
  subtract( id ) {
    id.padBinary( this.binaryLength - id.binaryLength );
    this.reverseBinary();
    id.reverseBinary();
    const arr = [];
    let highest = -1;
    let x;
    let y;
    for ( let i = 0; i < this.binaryLength; i++ ) {
      x = this.binary[ i ];
      y = id.binary[ i ];
      if ( x === '0' && y === '1' ) {
        if ( highest < i ) {
          for ( let j = i + 1; j < this.binaryLength; j++ ) {
            if ( this.binary[ j ] === '1' ) {
              highest = j;
              break;
            }
          }
          arr.unshift('1');
        } else {
          arr.unshift('0');
        }
      } else if ( x === '1' && y === '1' ) {
        if ( highest === i ) {
          for ( let j = i + 1; j < this.binaryLength; j++ ) {
            if ( this.binary[ j ] === '1' ) {
              highest = j;
              break;
            }
          }
          arr.unshift('1');
        } else {
          arr.unshift('0');
        }
      } else if ( x === '1' && y === '0' ) {
        if ( highest === i ) {
          arr.unshift('0');
        } else {
          arr.unshift('1');
        }
      } else {
        if ( highest > i ) {
          arr.unshift('1');
        } else {
          arr.unshift('0');
        }
      }
    }
    this.reverseBinary();
    id.reverseBinary();
    return new Id( arr.join('') );
  }

  /**
   * @param  {Id} id
   * @return {Id}
   */
  multiply( id ) {
    this.unpadBinary();
    id.unpadBinary();
    this.reverseBinary();
    let product = Id.zero();
    for ( let i = 0; i < this.binaryLength; i++ ) {
      if ( this.binary[ i ] === '1' ) {
        product = product.add( new Id( id.binary + '0'.repeat( i ) ) );
      }
    }
    this.reverseBinary();
    return product;
  }

  /**
   * @param  {Id} id
   * @return {Id}
   */
  divide( id ) {
    if ( this.equal( id ) ) {
      return { quotient: Id.one(), remainder: Id.zero() };
    }
    this.unpadBinary();
    id.unpadBinary();
    const arr = [];
    let begin = 0;
    let end = id.binaryLength;
    let remainder = Id.zero();
    let binary;
    let temp = null;
    while ( end <= this.binaryLength ) {
      binary = this.binary.slice( begin, end );
      temp = new Id( remainder.binary + binary );
      if ( id.compare( temp ) !== 1 ) {
        remainder = temp.subtract( id );
        temp = null;
        arr.push('1');
        begin = end;
        end = end + 1;
      } else {
        arr.push('0');
        end++;
      }
    }
    if ( temp !== null ) {
      remainder = temp;
    }
    const quotient = new Id( arr.join('') );
    return { quotient, remainder };
  }
}

module.exports = Id;
