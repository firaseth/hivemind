import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';

/**
 * 4.1 Distributed Swarm Execution (libp2p)
 * Initializes a P2P node for sharing tasks and votes across the network.
 */

export async function createP2PNode() {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
  });

  await node.start();
  console.log('[P2P] Node started with ID:', node.peerId.toString());
  
  return node;
}
