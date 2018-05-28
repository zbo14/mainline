'use strict';

const Id = require('./id');

/**
 * Bucket
 */
class Bucket {
  /**
   * constructor
   * @param {Object} [config = {}]
   * @param {Id}     [config.min = Id.zero()]
   * @param {Id}     [config.range = Id.range()]
   */
  constructor({ min = Id.zero(), range = Id.range() } = {}) {
    this.contacts = [];
    this.max = min.add( range );
    this.min = min;
    this.range = range;
  }

  get full() {
    return this.contacts.length === 8;
  }

  /** @param  {Contact} contact */
  addContact( contact ) {
    this.contacts.push( contact );
  }

  /** @param  {Id} id */
  removeContact( id ) {
    this.contacts = this.getOtherContacts( id );
  }

  /**
   * @param  {Id}                  id
   * @return {(Contact|undefined)}
   */
  getContact( id ) {
    return this.contacts.find( contact => contact.id.equal( id ) );
  }

  /**
   * @param  {Id}         id
   * @return {Contact[]}
   */
  getOtherContacts( id ) {
    return this.contacts.filter( contact => !contact.id.equal( id ) );
  }

  /**
   * @param  {Id}
   * @return {boolean}
   */
  hasContact( id ) {
    return this.getContact( id ) !== undefined;
  }

  /**
   * @param  {Bucket} bucket
   * @return {number}
   */
  compare( bucket ) {
    return this.min.compare( bucket.min );
  }

  /**
   * @param  {Id}     id
   * @return {boolean}
   */
  belongs( id ) {
    return this.min.compare( id ) <= 0 && this.max.compare( id ) === 1;
  }

  /**
   * @param  {?Contact} [contact = null]
   * @return {Bucket}
   */
  split( contact = null ) {
    const range = this.range.halve();
    const bucket = new Bucket({ min: this.min, range });
    this.min = bucket.max;
    this.range = range;
    const contacts = this.contacts.slice( 0 );
    if ( contact !== null ) {
      contacts.push( contact );
    }
    this.contacts = [];
    contacts.forEach( contact => {
      if ( this.belongs( contact.id ) ) {
        this.contacts.push( contact );
      } else {
        bucket.contacts.push( contact );
      }
    });
    return bucket;
  }

  /**
   * @param  {Bucket}   bucket
   * @return {boolean}
   */
  merge( bucket ) {
    if ( this.min.equal( bucket.max ) ) {
      this.min = bucket.min;
    } else if ( this.max.equal( bucket.min ) ) {
      this.max = bucket.max;
    } else {
      return false;
    }
    this.range = this.range.add( bucket.range );
    this.contacts.push( ...bucket.contacts );
    return true;
  }

  sortContacts() {
    this.contacts.sort( ( a, b ) => {
      if ( a.lastHeard < b.lastHeard ) {
        return -1;
      }
      if ( a.lastHeard > b.lastHeard ) {
        return 1;
      }
      return 0;
    });
  }

  /**
   * @param  {Contact} contact
   * @return {boolean}
   */
  replaceContact( contact ) {
    this.sortContacts();
    const c = this.contacts.find( contact => contact.isBad );
    if ( c === undefined ) {
      return false;
    }
    this.removeContact( c.id );
    this.addContact( contact );
    return true;
  }

  /**
   * @param  {Id}             id
   * @param  {dgram.Socket}   socket
   * @param  {Function}       cb
   */
  update( id, socket, cb ) {
    const contacts = this.contacts.filter( c => {
      return c.isQuestionable || c.isOverdue;
    });
    if ( contacts.length === 0 ) {
      return cb();
    }
    let count = 0;
    const onReply = c => () => {
      c.becomeGood();
      if ( ++count === contacts.length ) {
        cb();
      }
    };
    const onTimeout = c => () => {
      if ( c.isQuestionable ) {
        c.becomeBad();
      } else {
        c.becomeQuestionable();
      }
      if ( ++count === contacts.length ) {
        cb();
      }
    };
    contacts.forEach( c => {
      c.ping( id, socket, onReply( c ), onTimeout( c ) );
    });
  }
}

module.exports = Bucket;
