import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ROSLIB from 'roslib';
import BlockPalette from './components/BlockPalette';
import ProgramArea from './components/ProgramArea';

function App() {
  const [ros, setRos] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [botIp, setBotIp] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const connectToROS = () => {
    setConnecting(true);
    setConnectionError(null);
  
    const rosConnection = new ROSLIB.Ros({
      url: `ws://c20000002.local:9090`,
      
    });
  
    rosConnection.on('connection', () => {
      console.log('✅ Connected to ROS 2 websocket server.');
      setRos(rosConnection);
      setConnecting(false);
      setConnectionError(null);
    });
  
    rosConnection.on('error', error => {
      console.error('❌ Error connecting to websocket server:', error);
      setConnectionError('Failed to connect to robot. Please check if the robot is powered on and try again.');
      setConnecting(false);
      setRos(null);
    });
  
    rosConnection.on('close', () => {
      console.log('🔌 Connection to websocket server closed.');
      setRos(null);
      setConnectionError('Connection lost. Please try reconnecting.');
      setConnecting(false);
    });
  };
  

  useEffect(() => {
    connectToROS();
  }, []);

  const handleDrop = (block) => {
    setSequence(prev => [...prev, { ...block }]);
  };

  const updateSequence = (newSequence) => {
    setSequence(newSequence);
  };

  const removeBlock = (index) => {
    const newSequence = [...sequence];
    newSequence.splice(index, 1);
    setSequence(newSequence);
  };

  const SAFETY_DELAY = 2000; // 2 seconds

  const isWheelTransitionRisky = (prev, curr) => {
    if (!prev || !curr) return false;

    const linear = ['Move Forward', 'Move Backward'];
    const angular = ['Turn Left', 'Turn Right'];

    const isPrevLinear = linear.includes(prev.type);
    const isCurrLinear = linear.includes(curr.type);
    const isPrevAngular = angular.includes(prev.type);
    const isCurrAngular = angular.includes(curr.type);

    const isOpposite =
      (prev.type === 'Move Forward' && curr.type === 'Move Backward') ||
      (prev.type === 'Move Backward' && curr.type === 'Move Forward') ||
      (prev.type === 'Turn Left' && curr.type === 'Turn Right') ||
      (prev.type === 'Turn Right' && curr.type === 'Turn Left');

    const isTypeSwitch = (isPrevLinear && isCurrAngular) || (isPrevAngular && isCurrLinear);

    return isOpposite || isTypeSwitch;
  };

  const executeBlock = async (block) => {
    if (!ros) return;

    console.log(`Executing block: ${block.type} with params:`, block.params);

    // Handle Repeat block
    if (block.type === 'Repeat' && block.children) {
      const times = block.params?.times || 1;
      console.log(`Starting repeat block - ${times} iterations`);

      for (let i = 0; i < times; i++) {
        if (!isRunningRef.current) break;
        console.log(`Repeat iteration ${i + 1}/${times}`);

        for (const childBlock of block.children) {
          if (!isRunningRef.current) break;

          // Execute the child block
          await executeBlock(childBlock);
          
          // Add delay between each action in the repeat block
          if (childBlock.category === 'arm') {
            console.log('Adding delay between arm movements');
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          }
        }

        // Add delay between repeat iterations
        if (i < times - 1) {
          console.log('Adding delay between repeat iterations');
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }
      return;
    }

    // Handle arm movements
    if (block.category === 'arm') {
      console.log(`Executing arm command: ${block.type}`);
      const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/c20000002/arm_topic',
        messageType: 'std_msgs/msg/String'
      });

      // Publish the arm movement command
      topic.publish(new ROSLIB.Message({ data: block.type }));

      // Wait for the arm movement to complete
      const waitTime = 5000; // 5 seconds fixed delay for arm movements
      console.log(`Waiting ${waitTime/1000} seconds for arm movement to complete`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Handle wheel transitions
    if (block.category === 'wheel' && block._prevBlock) {
      if (isWheelTransitionRisky(block._prevBlock, block)) {
        console.log(`Adding safety delay of ${SAFETY_DELAY / 1000} seconds for risky wheel transition`);
        await new Promise(resolve => setTimeout(resolve, SAFETY_DELAY));
      }
    }

    // Handle different block types
    if (block.type === 'Delay') {
      const delayTime = (block.params?.seconds || 1) * 1000;
      console.log(`Executing delay for ${delayTime / 1000} seconds`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
      return;
    }

    if (block.category === 'wheel' && (block.type.includes('Left') || block.type.includes('Right'))) {
      console.log(`Executing wheel rotation: ${block.type}`);
    
      const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/c20000002/cmd_vel',
        messageType: 'geometry_msgs/msg/Twist'
      });
    
      const angularSpeed = 0.3; // rad/s
      const angleInDegrees = block.params.angle || 0;
      const angleInRadians = angleInDegrees * Math.PI / 180;
      const rotationTime = angleInRadians / (angularSpeed + 0.0634); // angularSpeed in seconds
    
      const twistMessage = new ROSLIB.Message({
        linear: { x: 0, y: 0, z: 0 },
        angular: {
          x: 0,
          y: 0,
          z: block.type.includes('Left') ? angularSpeed : -angularSpeed
        }
      });
    
      const interval = 100; // milliseconds
      let elapsed = 0;
      let number = 1;
    
      // Start measuring time
      const startTime = performance.now();
    
      // Repeatedly publish velocity commands
      const timer = setInterval(() => {
     
        topic.publish(twistMessage);
        elapsed += interval;
        if (elapsed >= rotationTime * 1000) {
          clearInterval(timer);
    
          // Stop rotation after time completes
          topic.publish(new ROSLIB.Message({
            linear: { x: 0, y: 0, z: 0 },
            angular: { x: 0, y: 0, z: 0 }
          }));
    
          // End measuring time
          const endTime = performance.now();
          const timeTaken = (endTime - startTime) / 1000; // Time in seconds
          console.log(`Rotation complete: ${angleInDegrees}° at ${angularSpeed} rad/s`);
          console.log(`Time taken for rotation: ${timeTaken} seconds`);
        }
      }, interval);
    
      // Wait until the interval completes
      await new Promise(resolve => setTimeout(resolve, rotationTime * 1000 + 100));
    }


    if (block.category === 'wheel' && (block.type === 'Move Forward' || block.type === 'Move Backward')) {
      console.log(`Executing wheel movement: ${block.type}`);
    
      const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/c20000002/cmd_vel',
        messageType: 'geometry_msgs/msg/Twist'
      });
    
      const linearSpeed = 0.3; // m/s, adjust based on your robot's capability
      const duration = block.params?.duration || 2; // Duration in seconds (default to 2 seconds)
    
      const twistMessage = new ROSLIB.Message({
        linear: { x: block.type === 'Move Forward' ? linearSpeed : -linearSpeed, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 }
      });
    
      console.log(`Sending linear velocity: ${linearSpeed} m/s, Direction: ${block.type}`);
    
      // Publish the message to move the robot
      topic.publish(twistMessage);
    
      // Wait for the duration of movement
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
      // Stop the robot after the duration
      topic.publish(new ROSLIB.Message({
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 }
      }));
    
      console.log(`${block.type} completed.`);
    }
    
    
    
    
  };

  const playSequence = async () => {
    if (!ros) {
      console.error("Cannot play sequence: ROS connection not established");
      return;
    }

    setIsRunning(true);
    isRunningRef.current = true;

    console.log(`Starting execution of sequence with ${sequence.length} blocks`);

    try {
      let prevBlock = null;
      for (const block of sequence) {
        if (!isRunningRef.current) {
          console.log("Execution stopped by user");
          break;
        }
        block._prevBlock = prevBlock;
        await executeBlock(block);
        prevBlock = block;
      }

      console.log("Sequence execution completed");
    } catch (error) {
      console.error("Error executing sequence:", error);
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  const stopSequence = () => {
    setIsRunning(false);
    isRunningRef.current = false;
  };

  return (
    
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50 font-[poppins]  ">
        
        <div className="container mx-auto p-4 sm:p-6">
          {/* Header Section */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-center flex-wrap gap-2">
                <img
                  src="/logo.png"
                  alt="Cento Logo"
                  className="h-12 w-12 sm:h-16 sm:w-16"
                />
                <h1 className="text-xl sm:text-3xl font-bold text-indigo-700">
                  CENTO ROBOT CONTROLLER
                </h1>
              </div>

              <div className="w-full sm:w-auto">
                {connecting ? (
                  <div className="flex items-center bg-blue-50 px-3 py-2 rounded-lg text-sm sm:text-base">
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span className="text-blue-700">Connecting to robot...</span>
                  </div>
                ) : connectionError ? (
                  <div className="w-full space-y-2">
                    <div className="bg-red-50 px-3 py-2 rounded-lg text-sm">
                      <p className="text-red-700 mb-2">{connectionError}</p>
                      <button
                        onClick={connectToROS}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Connection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
                   
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium ${ros ? 'text-green-500' : 'text-red-500'}`}>
                        {ros ? '✅ Connected' : '❌ Not Connected'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className="w-full lg:w-72">
              <BlockPalette />
            </div>
            <div className="flex-1">
              <ProgramArea
                sequence={sequence}
                onDrop={handleDrop}
                onPlay={playSequence}
                onStop={stopSequence}
                isRunning={isRunning}
                updateSequence={updateSequence}
                removeBlock={removeBlock}
                ros={ros}
              />
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
