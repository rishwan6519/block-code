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
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    fetch('http://localhost:5001/find-bot')
      .then(response => response.json())
      .then(data => {
        setBotIp(data.ip);
        console.log(`Connecting to ROS 2 bot at ${data.ip}`);

        const rosConnection = new ROSLIB.Ros({
          url: `ws://10.71.172.155:9090`
        });

        rosConnection.on('connection', () => {
          console.log('✅ Connected to ROS 2 websocket server.');
          setRos(rosConnection);
        });

        rosConnection.on('error', error => {
          console.error('❌ Error connecting to websocket server:', error);
        });

        rosConnection.on('close', () => {
          console.log('🔌 Connection to websocket server closed.');
          setRos(null);
        });
      })
      .catch(error => {
        console.error('❌ Failed to find bot:', error);
      });
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
    console.log(`isPrevLinear: ${isPrevLinear}, isCurrLinear: ${isCurrLinear}, isPrevAngular: ${isPrevAngular}, isCurrAngular: ${isCurrAngular}`);

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

    if (block.category === 'wheel' && block._prevBlock) {
      if (isWheelTransitionRisky(block._prevBlock, block)) {
        console.log(`Adding safety delay of ${SAFETY_DELAY / 1000} seconds for risky wheel transition`);
        await new Promise(resolve => setTimeout(resolve, SAFETY_DELAY));
      }
    }

    if (block.type === 'Repeat' && block.children) {
      const times = block.params?.times || 1;
      let prevBlock = null;

      for (let i = 0; i < times; i++) {
        if (!isRunningRef.current) break;
        console.log(`Repeat iteration ${i + 1}/${times}`);

        for (const childBlock of block.children) {
          if (!isRunningRef.current) break;
          childBlock._prevBlock = prevBlock;
          await executeBlock(childBlock);
          prevBlock = childBlock;
        }
      }
      return;
    }

    if (block.type === 'Delay') {
      const delayTime = (block.params?.seconds || 1) * 1000;
      console.log(`Executing delay for ${delayTime / 1000} seconds`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
      return;
    }

    if (block.category === 'arm') {
      console.log(`Executing arm command: ${block.type}`);
      const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/c20000002/arm_topic',
        messageType: 'std_msgs/msg/String'
      });
      topic.publish(new ROSLIB.Message({ data: block.type }));

      const waitTime = (block.params?.time || 1) * 1000;
      console.log(`Waiting ${waitTime}ms for arm action to complete`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else if (block.category === 'wheel') {
      console.log(`Executing wheel command: ${block.type}`);
      const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/c20000002/cmd_vel',
        messageType: 'geometry_msgs/msg/Twist'
      });

      const message = new ROSLIB.Message({
        linear: {
          x: block.type.includes('Forward') ? block.params.speed :
             block.type.includes('Backward') ? -block.params.speed : 0,
          y: 0,
          z: 0
        },
        angular: {
          x: 0,
          y: 0,
          z: block.type.includes('Left') ? block.params.angle * Math.PI / 180 :
             block.type.includes('Right') ? -block.params.angle * Math.PI / 180 : 0
        }
      });

      topic.publish(message);

      const waitTime = (block.params?.time || 1) * 1000;
      console.log(`Waiting ${waitTime}ms for wheel movement to complete`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-6">
          <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h1 className="text-3xl font-bold mb-4 text-indigo-700">ROS Robot Controller</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                <span className="text-gray-500">Bot IP:</span>
                <span className="font-medium">{botIp || 'Searching...'}</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${ros ? 'text-green-500' : 'text-red-500'}`}>
                  {ros ? '✅ Connected' : '❌ Not Connected'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <BlockPalette />
            <ProgramArea
              sequence={sequence}
              onDrop={handleDrop}
              onPlay={playSequence}
              onStop={stopSequence}
              isRunning={isRunning}
              updateSequence={updateSequence}
              removeBlock={removeBlock}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
