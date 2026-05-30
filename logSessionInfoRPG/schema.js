const { gql } = require('graphql-request');

const LOG_SESSION_INFO = gql`
  mutation LOG_SESSION_INFO($object: history_session_insert_input!) {
    insert_history_session_one(object: $object) {
      id
    }
  }
`;

module.exports = { LOG_SESSION_INFO };
