#ifndef IOS_TRANSPORT_H
#define IOS_TRANSPORT_H

#include "../Core/IOSRingBuffer.h"
#include <stdbool.h>

bool ios_transport_start(ios_ring_buffer_t* rb, const char* host, int port);
void ios_transport_stop(void);

#endif
