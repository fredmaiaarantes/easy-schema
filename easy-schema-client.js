import { check as c } from 'meteor/check';
import { Any, Optional, Integer, AnyOf, shapeSchema, hasModifiers, sharedSettings } from './shared';
import { isObject, pick } from './utils';
import { ValidationError } from 'meteor/mdg:validation-error';

const configure = config => {
  c(config, {
    basePath: Match.Maybe(String),
  });

  return Object.assign(sharedSettings, config);
}

Mongo.Collection.prototype.attachSchema = async function (schema = undefined) {
  try {
    const schemaToAttach = schema ? schema : (await import(`${sharedSettings.basePath}/${this._name}/schema.js`)).schema;
    if (!schemaToAttach) {
      throw new Error('No schema found');
    }

    this.schema = {...shapeSchema(schemaToAttach), '$id':`/${this._name}`};
    return;
  } catch (error) {
    console.error(error)
  }
};

const skipAutoCheck = () => {}; // no-op on the client side. this is here to support isomorphic code inside Meteor Methods.

const check = (data, schema) => { // full check only happens on the server so it's not an argument here
  if (data && hasModifiers(data)) { // check on the client doesn't validate update modifiers to reduce bundle size and since it shouldn't be necessary. update modifiers are checked on the server.
    return true;
  }

  // schema passed in can be customized instead of using the one on the collection.
  // if it it's already been shaped, then we don't need to do that again but otherwise we do so that {type: } and conditions are converted properly
  const schemaToCheck = isObject(schema) ? (schema['$id'] ? pick(schema, Object.keys(data)) : shapeSchema(schema)) : schema;

  try {
    c(data, schemaToCheck);
    return true;
  } catch (error) {
    const message = error.message.includes('Match.Where') ? `Validation error: ${error.path} failed condition` : `Validation error: ${error.message.replaceAll('Match error: ', '')}`
    throw new ValidationError([{name: error.path, type: 'type', message}]);
  }
};

const EasySchema = { skipAutoCheck, configure };
export { check, Any, Optional, Integer, AnyOf, EasySchema };
