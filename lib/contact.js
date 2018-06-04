'use strict';

const { createHash, randomBytes } = require('crypto');
const Id                          = require('./id');

const newTx = () => randomBytes( 2 ).toString('base64');

class Contact {
  /**
   * constructor
   * @param {Object} config
   * @param {string} config.host
   * @param {number} config.port
   */
  constructor( config ) {
    this.buffer = Buffer.alloc( 6 );
    this.host = config.host;
    this.port = config.port;
    this.host.split('.').forEach( ( v, i ) => {
      this.buffer[ i ] = parseInt( v );
    });
    this.buffer.writeInt16BE( this.port, 4 );
    const hash = createHash('sha1');
    hash.update( this.buffer );
    this.id = new Id( hash.digest() );
    this.update( new Date( 0 ) );
  }


  /**
   * Sends a ping message to the contact.
   *
   * @param  {Server}       server
   * @param  {Function}     onReply
   * @param  {Function}     [onTimeout = onReply]
   */
  ping( server, onReply, onTimeout = onReply ) {
    this.send({ cmd: 'ping', server }, onReply, onTimeout );
  }

  /**
   * Sends a pong message to the contact.
   *
   * @param  {Server}   server
   * @param  {string}       tx
   */
  pong( server, tx ) {
    this.send({ cmd: 'pong', server, tx });
  }

  /**
   * Sends a find message to the contact.
   *
   * @param  {Server}       server
   * @param  {Id}           target
   * @param  {Function}     onReply
   * @param  {Function}     [onTimeout = onReply]
   */
  find( server, target, onReply, onTimeout = onReply ) {
    this.send({
      cmd: 'find',
      data: target.base64,
      server
    }, onReply, onTimeout );
  }

  /**
   * Sends a found message with a contact to the contact.
   *
   * @param  {Server}       server
   * @param  {Contact}      contact
   * @param  {string}       tx
   */
  foundContact( server, contact, tx ) {
    this.send({
      cmd: 'found',
      server,
      data: {
        host: contact.host,
        port: contact.port
      },
      tx
    });
  }

  /**
   * Sends a found message with closest contacts to the contact.
   *
   * @param  {Server}       server
   * @param  {Contact[]}    closest
   * @param  {string}       tx
   */
  foundClosest( server, closest, tx ) {
    const data = closest.map( ({ host, port }) => ({ host, port }) );
    this.send({ cmd: 'found', server, data, tx });
  }

  static get idleTimeout() {
    return 2000;
  }

  static get messageTimeout() {
    return 2000;
  }

  get base64() {
    return this.id.base64;
  }

  get isBad() {
    return this.status === 'bad';
  }

  get isGood() {
    return this.status === 'good';
  }

  get isOverdue() {
    return this.isGood && Date.now() - this.lastHeard > Contact.idleTimeout;
  }

  get isQuestionable() {
    return this.status === 'questionable';
  }

  becomeBad() {
    this.status = 'bad';
  }

  becomeQuestionable() {
    this.status = 'questionable';
  }

  update( time = Date.now() ) {
    this.lastHeard = time;
    this.status = 'good';
  }

  compare( contact ) {
    return this.id.compare( contact.id );
  }

  equal( contact ) {
    return this.id.equal( contact.id );
  }

  send({ cmd, server, data = undefined, tx = newTx() }, onReply, onTimeout ) {
    const msg = { cmd, id: server.base64, data, tx };
    const evt = `${this.base64}:${tx}`;
    let timeout;
    if ( onReply !== undefined ) {
      server.once( evt, ( ...params ) => {
        clearTimeout( timeout );
        onReply( ...params );
      });
    }
    if ( onTimeout !== undefined ) {
      timeout = setTimeout( () => {
        server.removeAllListeners( evt );
        if ( this.isGood ) {
          this.becomeQuestionable();
        } else if ( this.isQuestionable ) {
          this.becomeBad();
        }
        onTimeout();
      }, Contact.messageTimeout );
    }
    server.send( JSON.stringify( msg ), this.port, this.host );
  }
}

module.exports = Contact;
