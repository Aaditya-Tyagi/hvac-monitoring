const { GraphQLClient } = require('graphql-request');

const client = new GraphQLClient(process.env.GRAPHQL_ENDPOINT, {
  headers: {
    'content-type': 'application/json',
    'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
  },
});

module.exports = { client };
