#include <stdio.h>
#include <stdlib.h>
#include <rabbitmq-c/amqp.h>
#include <rabbitmq-c/tcp_socket.h>

char * get_env(char *env) {
    char *env_var_value = getenv(env);

    if (env_var_value == NULL) {
        printf("env %s is not set\n", env);
        exit(1);
    }

    return env_var_value;
}

void die_on_amqp_error(amqp_rpc_reply_t x, char const *context) {
    switch (x.reply_type) {
        case AMQP_RESPONSE_NORMAL:
            return;

        case AMQP_RESPONSE_NONE:
            fprintf(stderr, "%s: missing RPC reply type!\n", context);
            break;

        case AMQP_RESPONSE_LIBRARY_EXCEPTION:
            fprintf(stderr, "%s: %s\n", context, amqp_error_string2(x.library_error));
            break;

        case AMQP_RESPONSE_SERVER_EXCEPTION:
            switch (x.reply.id) {
                case AMQP_CONNECTION_CLOSE_METHOD: {
                    amqp_connection_close_t *m = (amqp_connection_close_t *)x.reply.decoded;
                    fprintf(stderr, "%s: server connection error %uh, message: %.*s\n",
                            context,
                            m->reply_code,
                            (int)m->reply_text.len,
                            (char *)m->reply_text.bytes);
                    break;
                }
                case AMQP_CHANNEL_CLOSE_METHOD: {
                    amqp_channel_close_t *m = (amqp_channel_close_t *)x.reply.decoded;
                    fprintf(stderr, "%s: server channel error %uh, message: %.*s\n",
                            context,
                            m->reply_code,
                            (int)m->reply_text.len,
                            (char *)m->reply_text.bytes);
                    break;
                }
                default:
                    fprintf(stderr, "%s: unknown server error, method id 0x%08X\n", context, x.reply.id);
                    break;
            }
            break;
    }

    exit(1);
}

int main() {
    const char *hostname = get_env("RABBITMQ_HOST");
    const int port = atoi(get_env("RABBITMQ_PORT"));
    const char *queue_name = get_env("RABBITMQ_QUEUE");
    const char *username = get_env("RABBITMQ_USERNAME");
    const char *password = get_env("RABBITMQ_PASSWORD");

    amqp_connection_state_t conn;
    amqp_socket_t *socket = NULL;

    conn = amqp_new_connection();
    socket = amqp_tcp_socket_new(conn);

    if (!socket) {
        fprintf(stderr, "failed to create socket\n");
        return 1;
    }

    if (amqp_socket_open(socket, hostname, port)) {
        fprintf(stderr, "failed to connect to rabbitmq\n");
        return 1;
    }

    die_on_amqp_error(amqp_login(conn, "/", 0, 131072, 0, AMQP_SASL_METHOD_PLAIN, username, password), "login");

    amqp_channel_open(conn, 1);
    die_on_amqp_error(amqp_get_rpc_reply(conn), "opening channel");

    amqp_queue_declare(conn, 1, amqp_cstring_bytes(queue_name), 1, 0, 0, 1, amqp_empty_table);
    die_on_amqp_error(amqp_get_rpc_reply(conn), "declaring queue");

    amqp_basic_consume(conn, 1, amqp_cstring_bytes(queue_name), amqp_empty_bytes, 0, 1, 0, amqp_empty_table);
    die_on_amqp_error(amqp_get_rpc_reply(conn), "consuming");

    while (1) {
        amqp_envelope_t envelope;
        amqp_maybe_release_buffers(conn);

        amqp_rpc_reply_t result = amqp_consume_message(conn, &envelope, NULL, 0);

        if (result.reply_type != AMQP_RESPONSE_NORMAL) {
            break;
        }

        printf("received message: %.*s\n",
               (int)envelope.message.body.len,
               (char *)envelope.message.body.bytes);

        printf("irrigating...\n");

        amqp_destroy_envelope(&envelope);
    }

    die_on_amqp_error(amqp_channel_close(conn, 1, AMQP_REPLY_SUCCESS), "closing channel");
    die_on_amqp_error(amqp_connection_close(conn, AMQP_REPLY_SUCCESS), "closing connection");
    amqp_destroy_connection(conn);

    return 0;
}
