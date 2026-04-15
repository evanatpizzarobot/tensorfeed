'use client';

/**
 * Neural network background animation for the homepage hero.
 * Pure CSS/SVG, no canvas or heavy JS. Renders a network of
 * nodes with animated data pulses flowing along connecting lines.
 * Designed to be subtle and performant (uses CSS animations only).
 */
export default function NeuralNetworkBg() {
  // Node positions (x%, y%) placed to create a natural network feel
  const nodes: [number, number][] = [
    [8, 20], [18, 65], [25, 30], [32, 80], [38, 15],
    [45, 55], [52, 25], [55, 75], [62, 40], [68, 70],
    [72, 18], [78, 55], [82, 30], [88, 65], [92, 20],
    [15, 45], [35, 50], [50, 45], [65, 50], [85, 45],
  ];

  // Connections between nodes (index pairs)
  const edges: [number, number][] = [
    [0, 2], [0, 15], [1, 15], [1, 3], [2, 4], [2, 16],
    [3, 16], [4, 6], [5, 16], [5, 17], [6, 10], [6, 17],
    [7, 17], [7, 9], [8, 17], [8, 18], [9, 18], [9, 13],
    [10, 12], [10, 18], [11, 18], [11, 19], [12, 14], [12, 19],
    [13, 19], [15, 16], [16, 17], [17, 18], [18, 19],
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Pulse gradient for the traveling data dots */}
          <radialGradient id="pulse-glow">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Connection lines */}
        {edges.map(([a, b], i) => (
          <line
            key={`edge-${i}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke="var(--accent-primary)"
            strokeOpacity="0.06"
            strokeWidth="0.15"
          />
        ))}

        {/* Animated pulses traveling along edges */}
        {edges.map(([a, b], i) => {
          // Stagger animations so they don't all fire at once
          const delay = (i * 1.7) % 12;
          const duration = 3 + (i % 4);
          return (
            <circle
              key={`pulse-${i}`}
              r="0.4"
              fill="var(--accent-primary)"
              opacity="0"
            >
              <animateMotion
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
                path={`M${nodes[a][0]},${nodes[a][1]} L${nodes[b][0]},${nodes[b][1]}`}
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0.6;0"
                keyTimes="0;0.1;0.9;1"
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}

        {/* Network nodes */}
        {nodes.map(([x, y], i) => (
          <g key={`node-${i}`}>
            {/* Outer glow */}
            <circle
              cx={x}
              cy={y}
              r="0.8"
              fill="var(--accent-primary)"
              opacity="0.04"
            />
            {/* Core dot */}
            <circle
              cx={x}
              cy={y}
              r="0.25"
              fill="var(--accent-primary)"
              opacity="0.15"
            >
              {/* Subtle breathing animation, staggered */}
              <animate
                attributeName="opacity"
                values="0.1;0.25;0.1"
                dur={`${3 + (i % 3)}s`}
                begin={`${(i * 0.5) % 4}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
