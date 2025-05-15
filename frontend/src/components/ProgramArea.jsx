import React from 'react';
import { useDrop } from 'react-dnd';
import { IoHandLeftOutline } from 'react-icons/io5';
import ROSLIB from 'roslib';
import { FaPersonWalking } from "react-icons/fa6";


const NestedBlock = ({ block, index, parentSequence, updateParent, isRunning, path = [] }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      // Only handle if this is the immediate target
      if (monitor.didDrop()) {
        return;
      }
      
      if (block.type === 'Repeat') {
        const newBlock = { ...item };
        if (!block.children) block.children = [];
        block.children.push(newBlock);
        updateParent([...parentSequence]);
        return { dropped: true };
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  }));

  const removeFromChildren = (childIndex) => {
    block.children.splice(childIndex, 1);
    updateParent([...parentSequence]);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'arm':
        return <IoHandLeftOutline className="text-white" />;
      case 'wheel':
        return <FaPersonWalking className="text-white" />;
      case 'control':
        return '⚙️';
      default:
        return '📦';
    }
  };

  const getBlockColors = (category) => {
    switch (category) {
      case 'arm':
        return {
          bg: 'bg-gradient-to-r from-purple-600 to-purple-500',
          border: 'border-purple-100',
          highlight: 'bg-purple-300/20'
        };
      case 'wheel':
        return {
          bg: 'bg-gradient-to-r from-blue-600 to-blue-500',
          border: 'border-blue-300',
          highlight: 'bg-blue-400/20'
        };
      case 'control':
        return {
          bg: 'bg-gradient-to-r from-amber-400 to-amber-400',
          border: 'border-amber-300',
          highlight: 'bg-amber-400/20'
        };
      default:
        return {
          bg: 'bg-gray-600',
          border: 'border-gray-300',
          highlight: 'bg-gray-400/20'
        };
    }
  };
  
  const colors = getBlockColors(block.category);

  const handleRemoveBlock = (e) => {
    e.stopPropagation();
    // Use path to determine which array and index to modify
    const currentPath = [...path];
    const index = currentPath.pop();
    updateParent(parentSequence, 'remove', currentPath, index);
  };
  

  return (
    <div className={`${colors.bg} rounded-lg shadow-md mb-3 overflow-hidden transition-all duration-200 w-full max-w-[500px] mx-auto`}>

      <div className="p-3 text-white relative group">
        <div className="flex items-center">
          <span className="mr-2">{getCategoryIcon(block.category)}</span>
          <span className="font-medium">{block.type}</span>
          {block.params && Object.entries(block.params).map(([key, value]) => (
            <div key={key} className="flex items-center bg-white/20 mx-1 px-2 py-1 rounded-lg">
              <span className="text-sm mr-1">{key}:</span>
              <input
              
  type="number"
  min={key === 'speed' ? 0.1 : key === 'angle' ? 1 : undefined}
  max={key === 'speed' ? 0.3 : key === 'angle' ? 360 : undefined}
  step="0.01"
  className="bg-white/10 px-2 py-0.5 rounded text-sm w-14 focus:outline-none focus:ring-2 focus:ring-white/50"
  defaultValue={value}
  onChange={(e) => {
    let val = parseFloat(e.target.value);
    if (key === 'speed') {
      val = Math.min(Math.max(val, 0.1), 0.3);
    } else if (key === 'angle') {
      val = Math.min(Math.max(val, 1), 360);
    }
    block.params[key] = val;
    updateParent([...parentSequence]);
  }}
  disabled={isRunning}
/>

            </div>
          ))}
          
          <button 
            onClick={handleRemoveBlock}
            disabled={isRunning}
            className="opacity-0 group-hover:opacity-100 ml-auto bg-red-500/80 hover:bg-red-600 p-1 rounded-full transition-opacity"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      
      {block.isContainer && (
        <div
          ref={drop}
          className={`${
            isOver ? colors.highlight : 'bg-black/10'
          } mx-2 mb-2 p-2 rounded-lg border-2 border-dashed ${colors.border} transition-colors duration-200 min-h-12`}
        >
          {block.children?.length > 0 ? (
            block.children.map((child, childIndex) => (
              <NestedBlock
                key={childIndex}
                block={child}
                index={childIndex}
                parentSequence={block.children}
                updateParent={(newChildren, action, path, idx) => {
                  if (action === 'remove') {
                    newChildren.splice(idx, 1);
                  } else {
                    block.children = newChildren;
                  }
                  updateParent([...parentSequence]);
                }}
                isRunning={isRunning}
                path={[...path, childIndex]}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-12 text-white/60 text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Drag blocks here
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProgramArea = ({ sequence, onDrop, onPlay, onStop, isRunning, updateSequence, removeBlock, ros }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      // Only handle if this didn't already drop inside a nested container
      if (monitor.didDrop()) {
        return;
      }
      onDrop(item);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  }));

  const updateBlockInSequence = (newSequence, action, path, index) => {
    if (action === 'remove') {
      // Get to the correct array using the path
      let currentArray = sequence;
      for (const idx of path) {
        currentArray = currentArray[idx].children;
      }
      // Remove the block at the specified index
      currentArray.splice(index, 1);
      updateSequence([...sequence]);
    } else {
      updateSequence(newSequence);
    }
  };

  const handleHomeClick = () => {
    if (!ros) return;
    
    const topic = new ROSLIB.Topic({
      ros: ros,
      name: '/c20000002/arm_topic',
      messageType: 'std_msgs/msg/String'
    });

    topic.publish(new ROSLIB.Message({ data: 'Home' }));
    console.log('Sent Home command to robot');

  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">Program</h2>
        
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={onPlay}
            disabled={isRunning || sequence.length === 0}
            className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg shadow transition-all text-sm sm:text-base ${
              isRunning || sequence.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-md'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
            </svg>
            Play
          </button>
          
          <button
            onClick={onStop}
            disabled={!isRunning}
            className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg shadow transition-all text-sm sm:text-base ${
              !isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white hover:shadow-md'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"></path>
            </svg>
            Stop
          </button>

          <button
            onClick={handleHomeClick}
            disabled={isRunning}
            className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg shadow transition-all text-sm sm:text-base ${
              isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-500 hover:bg-indigo-600 text-white hover:shadow-md'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Home
          </button>
        </div>
      </div>
      
      <div
        ref={drop}
        className={`min-h-[300px] sm:min-h-[400px] border-2 border-dashed rounded-lg p-3 sm:p-4 transition-colors duration-200 ${
          isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        {sequence.length > 0 ? (
          sequence.map((block, index) => (
            <NestedBlock
              key={index}
              block={block}
              index={index}
              parentSequence={sequence}
              updateParent={updateBlockInSequence}
              isRunning={isRunning}
              path={[index]}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4v16m8-8H4"></path>
            </svg>
            <p className="text-lg">Drag blocks here to build your program</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramArea;