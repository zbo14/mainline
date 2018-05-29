'use strict';

const { createHash, randomBytes } = require('crypto');
const Id                          = require('./id');

/**
 * Contact
 */
class Contact {
  /**
   * constructor
   * @param {(Buffer|Object|string)} info
   */
  constructor( info ) {
    this.buffer = Buffer.alloc( 6 );
    if ( Buffer.isBuffer( info ) ) {
      this.fromBuffer( info );
    } else if ( typeof info === 'string' ) {
      this.fromString( info );
    } else {
      this.fromObject( info );
    }
    this.setId();
    this.becomeGood();
    this.heard( new Date( 0 ) );
  }

  /**
   * @return {Contact}
   */
  static random() {
    return new Contact( randomBytes( 6 ) );
  }

  /**
   * @member {string}
   */
  get base64() {
    return this.id.base64;
  }

  heard( time = Date.now() ) {
    this.lastHeard = time;
  }

  becomeGood() {
    this.status = 'good';
  }

  becomeQuestionable() {
    this.status = 'questionable';
  }

  becomeBad() {
    this.status = 'bad';
  }

  get isGood() {
    return this.status === 'good';
  }

  get isOverdue() {
    return this.isGood && Date.now() - this.lastHeard > 2000;
  }

  get isQuestionable() {
    return this.status === 'questionable';
  }

  get isBad() {
    return this.status === 'bad';
  }

  fromBuffer( buffer ) {
    buffer.copy( this.buffer, 0, 0, 6 );
    this.host = this.buffer.slice( 0, 4 ).join('.');
    this.port = this.buffer.readInt16BE( 4 );
  }

  fromObject( obj ) {
    this.host = obj.host;
    this.port = obj.port;
    this.setBuffer();
  }

  fromString( str ) {
    [ this.host, this.port ] = str.split(':');
    this.port = parseInt( this.port );
    this.setBuffer();
  }

  setBuffer() {
    this.host.split('.').forEach( ( v, i ) => {
      this.buffer[ i ] = parseInt( v );
    });
    this.buffer.writeInt16BE( this.port, 4 );
  }

  setId() {
    const hash = createHash('sha1');
    hash.update( this.buffer );
    this.id = new Id( hash.digest() );
  }

  send({ cmd, id, data = undefined, socket }, onReply, onTimeout ) {
    const tx = randomBytes( 2 ).toString('base64');
    const msg = { cmd, id: id.base64, data, tx };
    const evt = `${this.base64}:${tx}`;
    let timeout;
    if ( onReply !== undefined ) {
      socket.once( evt, ( ...params ) => {
        clearTimeout( timeout );
        this.becomeGood();
        this.heard();
        onReply( ...params );
      });
    }
    if ( onTimeout !== undefined ) {
      timeout = setTimeout( () => {
        socket.removeAllListeners( evt );
        if ( this.isGood ) {
          this.becomeQuestionable();
        } else if ( this.isQuestionable ) {
          this.becomeBad();
        }
        onTimeout();
      }, 2000 );
    }
    socket.send( JSON.stringify( msg ), this.port, this.host );
  }

  /**
   * @param  {Id}           id
   * @param  {dgram.Socket} socket
   * @param  {Function}     onReply
   * @param  {Function}     [onTimeout = onReply]
   */
  ping( id, socket, onReply, onTimeout = onReply ) {
    this.send({ cmd: 'ping', id, socket }, onReply, onTimeout );
  }

  /**
   * @param  {dgram.Socket} socket
   * @param  {Id}           id
   */
  pong( id, socket ) {
    this.send({ cmd: 'pong', id, socket });
  }

  /**
   * @param  {Id}           id
   * @param  {Id}           target
   * @param  {dgram.Socket} socket
   * @param  {Function}     onReply
   * @param  {Function}     [onTimeout = onReply]
   */
  find( id, target, socket, onReply, onTimeout = onReply ) {
    this.send(
      { cmd: 'find', id, data: target.base64, socket }, onReply, onTimeout
    );
  }

  /**
   * @param  {Id}           id
   * @param  {Contact}      contact
   * @param  {dgram.Socket} socket
   */
  foundContact( id, contact, socket ) {
    this.send({ cmd: 'found', id, data: contact.base64, socket });
  }

  /**
   * @param  {Id}           id
   * @param  {Contact[]}    closest
   * @param  {dgram.Socket} socket
   */
  foundClosest( id, closest, socket ) {
    const data = closest.map( ({ base64 }) => base64 );
    this.send({ cmd: 'found', id, data, socket });
  }

  /**
   * @param  {Contact} contact
   * @return {number}
   */
  compare( contact ) {
    return this.id.compare( contact.id );
  }

  /**
   * @param  {Contact} contact
   * @return {boolean}
   */
  equal( contact ) {
    return this.id.equal( contact.id );
  }
}

module.exports = Contact;
