'use strict';

const Bucket = require('./bucket');

class RoutingTable {
  constructor() {
    this.buckets = [ new Bucket() ];
  }

  /**
   * @member {Contact[]}
   */
  get contacts() {
    return this.buckets.reduce( ( acc, bucket ) => {
      return acc.concat( bucket.contacts );
    }, [] );
  }

  /**
   * @param  {Id}     id
   * @return {Bucket}
   */
  getBucket( id ) {
    return this.buckets.find( bucket => bucket.belongs( id ) );
  }

  /**
   * @param  {Id}                 id
   * @return {(Contact|undefined)}
   */
  getContact( id ) {
    return this.getBucket( id ).getContact( id );
  }

  /**
   * @param  {Id}     id
   * @return {boolean}
   */
  hasContact( id ) {
    return this.getBucket( id ).hasContact( id );
  }

  /**
   * @param  {Id}                   id
   * @return {(Contact|Contact[])}
   */
  find( id ) {
    const contact = this.getContact( id );
    if ( contact !== undefined ) {
      return contact;
    }
    const contacts = [];
    this.buckets.forEach( bucket => {
      contacts.push( ...bucket.contacts );
    });
    contacts.sort( ( a, b ) => {
      const diff1 = a.id.difference( id );
      const diff2 = b.id.difference( id );
      return diff1.compare( diff2 );
    });
    return contacts.slice( 0, 8 );
  }

  /**
   *
   * @param {Contact}   contact
   * @param {Server}    server
   * @param {Function}  cb
   */
  update( contact, server, cb ) {
    const bucket = this.getBucket( contact.id );
    bucket.update( contact, server, success => {
      if ( success ) {
        return cb( true );
      }
      if ( !bucket.belongs( server.id ) ) {
        return cb( false );
      }
      this.buckets.push( bucket.split() );
      this.update( contact, server, cb );
    });
  }
}

module.exports = RoutingTable;
