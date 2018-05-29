
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
   * @param  {Id}   id
   * @return {(Contact|Contact[])}
   */
  findNode( id ) {
    const contact = this.getContact( id );
    if ( contact !== undefined ) {
      return contact;
    }
    const contacts = [];
    this.buckets.forEach( bucket => {
      contacts.push( ...bucket.contacts );
    });
    contacts.sort( ( a, b ) => {
      return a.id.difference( id ).compare( b.id.difference( id ) );
    });
    return contacts.slice( 0, 8 );
  }

  /**
   * @param {Contact}        contact
   * @param {Id}             id
   * @param {dgram.Socket}   socket
   * @param {Function}       cb
   */
  addContact( contact, id, socket, cb ) {
    const bucket = this.getBucket( contact.id );
    bucket.addContact( contact, id, socket, success => {
      if ( success ) {
        return cb( true );
      }
      if ( bucket.belongs( id ) ) {
        this.buckets.push( bucket.split() );
        return this.addContact( contact, id, socket, cb );
      }
      cb( false );
    });
  }
}

module.exports = RoutingTable;
