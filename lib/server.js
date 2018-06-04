'use strict';

const { createSocket } = require('dgram');
const Bucket           = require('./bucket');
const Contact          = require('./contact');
const Id               = require('./id');
const RoutingTable     = require('./routingtable');

const insertContact = ( arr, contact ) => {
  if ( arr.length > 0 ) {
    for ( let i = 0; i < arr.length; i++ ) {
      if ( contact.compare( arr[ i ] ) <= 0 ) {
        arr.splice( i, 0, contact );
        return;
      }
    }
  }
  arr.push( contact );
};

class Server {
  /**
   * constructor
   * @param {Object} config
   * @param {string} config.host
   * @param {number} config.port
   */
  constructor( config ) {
    this.contact = new Contact( config );
    this.queue = [];
    this.routingTable = new RoutingTable();
  }

  /**
   * Starts the server.
   */
  start() {
    this.socket = createSocket('udp4');
    this.on( 'message', ( msg, rconfig ) => {
      msg = JSON.parse( msg.toString() );
      const contact = new Contact({
        host: rconfig.address,
        port: rconfig.port

      });
      contact.update();
      this.handleMessage( contact, msg );
      this.routingTable.update( contact, this, success => {
        if ( success ) {
          this.emit( `update:${contact.base64}` );
        }
      });
    });
    this.socket.bind( this.contact.port );
  }

  /**
   * Stops the server.
   */
  stop() {
    this.socket.close();
  }

  /**
   * Send a ping message to the contact.
   *
   * @param  {Contact}  contact
   * @param  {Function} onReply
   * @param  {Function} onTimeout
   */
  ping( contact, onReply, onTimeout ) {
    contact.ping( this, onReply, onTimeout );
  }

  /**
   * Iteratively sends find messages to contacts with the given target.
   * Calls the callback with the target's contact information or
   * up to the 8 closest contacts it sent messages to.
   *
   * @param  {Id}        target
   * @param  {Function}  cb
   */
  iterfind( target, cb ) {
    const contact = this.getContact( target );
    if ( contact !== undefined ) {
      return cb( contact );
    }
    this.contacted = [];
    this.queue = this.contacts;
    let queries = 0;
    const callback = result => {
      if ( result instanceof Contact ) {
        return cb( result );
      }
      if ( result instanceof Array && result.length > 0 ) {
        for ( let i = 0; i < result.length; i++ ) {
          insertContact( this.queue, result[ i ]);
        }
      }
      if ( ++queries === Server.maxQueries || this.queue.length === 0 ) {
        const closest = this.contacted.slice( 0, Bucket.maxContacts );
        return cb( closest );
      }
      this.find( target, callback );
    };
    if ( this.queue.length === 0 ) {
      return cb([]);
    }
    this.find( target, callback );
  }

  emit( evt, ...params ) {
    this.socket.emit( evt, ...params );
  }

  on( evt, cb ) {
    this.socket.on( evt, ( ...params ) => setImmediate( cb, ...params ) );
  }

  once( evt, cb ) {
    this.socket.once( evt, ( ...params ) => setImmediate( cb, ...params ) );
  }

  removeAllListeners( evt ) {
    this.socket.removeAllListeners( evt );
  }

  static get maxQueries() {
    return 15;
  }

  get base64() {
    return this.id.base64;
  }

  get contacts() {
    return this.routingTable.contacts;
  }

  get id() {
    return this.contact.id;
  }

  getContact( id ) {
    return this.routingTable.getContact( id );
  }

  hasContact( id ) {
    return this.routingTable.hasContact( id );
  }

  handleMessage( contact, msg ) {
    switch ( msg.cmd ) {
      case 'ping':
        return this.handlePing( contact, msg );
      case 'pong':
        return this.handlePong( contact, msg );
      case 'find':
        return this.handleFind( contact, msg );
      case 'found':
        return this.handleFound( contact, msg );
      default:
    }
  }

  handlePing( contact, msg ) {
    contact.pong( this, msg.tx );
  }

  handlePong( contact, msg ) {
    this.emit( `${contact.base64}:${msg.tx}`, true );
  }

  handleFind( contact, msg ) {
    const target = new Id( Buffer.from( msg.data, 'base64' ) );
    const result = this.routingTable.find( target );
    if ( result instanceof Array ) {
      return contact.foundClosest( this, result, msg.tx );
    }
    contact.foundContact( this, result, msg.tx );
  }

  handleFound( contact, msg ) {
    let result;
    if ( msg.data instanceof Array ) {
      result = msg.data.map( config => new Contact( config ) );
    } else {
      result = new Contact( msg.data );
    }
    this.emit( `${contact.base64}:${msg.tx}`, result );
  }

  find( target, cb ) {
    const contact = this.queue.shift();
    insertContact( this.contacted, contact );
    contact.find( this, target, cb );
  }

  send( msg, port, host ) {
    this.socket.send( msg, port, host );
  }
}

module.exports = Server;
