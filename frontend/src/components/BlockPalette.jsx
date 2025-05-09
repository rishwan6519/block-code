import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { RiRobot2Line } from "react-icons/ri";


const Block = ({ block, color }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: { ...block },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }));

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'arm':
        return '👋';
      case 'wheel':
        return '🚗';
      case 'control':
        return '⚙️';
      default:
        return '📦';
    }
  };

  const getBlockStyle = () => {
    const baseStyle = `${color} p-3 mb-3 rounded-lg text-white cursor-move shadow-md transition-all duration-200 transform hover:shadow-lg`;
    return isDragging ? `${baseStyle} opacity-50 scale-95` : `${baseStyle} opacity-100`;
  };

  return (
    <div ref={drag} className={getBlockStyle()}>
      <div className="flex items-center gap-2">
        <span className="mr-2">{getCategoryIcon(block.category)}</span>
        <span className="font-medium">{block.type}</span>
        {block.params && Object.entries(block.params).map(([key, value]) => (
          <div key={key} className="flex items-center bg-white/20 px-2 py-1 rounded-lg">
            <span className="text-sm mr-1">{key}:</span>
            <input
              type="number"
              className="bg-white/10 px-2 py-0.5 rounded text-sm w-14 focus:outline-none focus:ring-2 focus:ring-white/50"
              defaultValue={value}
              onChange={(e) => block.params[key] = parseFloat(e.target.value)}
            />
          </div>
        ))}
      </div>
      {block.isContainer && (
        <div className="ml-6 mt-2 border-l-2 border-white/30 pl-3">
          <div className="text-sm text-white/70">Drag blocks here</div>
        </div>
      )}
    </div>
  );
};

const BlockPalette = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categories = {
    arm: {
      name: 'Hand Movements',
      icon: '👋',
      color: 'bg-gradient-to-r from-purple-600 to-purple-500',
      blocks: [
        { type: 'Hi', category: 'arm' },
        { type: 'Namaste', category: 'arm' },
        { type: 'LHandUp', category: 'arm' },
        { type: 'RHandUp', category: 'arm' },
        { type: 'Home', category: 'arm' },
        { type: 'HandsUp', category: 'arm' }
      ]
    },
    wheel: {
      name: 'Robot Movements',
      icon: <RiRobot2Line />,
      color: 'bg-gradient-to-r from-blue-600 to-blue-500',
      blocks: [
        { type: 'Move Forward', category: 'wheel', params: { speed: 0.3 } },
        { type: 'Move Backward', category: 'wheel', params: { speed: 0.3 } },
        { type: 'Turn Left', category: 'wheel', params: { angle: 90 } },
        { type: 'Turn Right', category: 'wheel', params: { angle: 90 } }
      ]
    },
    control: {
      name: 'Control',
      icon: '⚙️',
      color: 'bg-gradient-to-r from-amber-500 to-amber-400',
      blocks: [
        { type: 'Repeat', category: 'control', params: { times: 3 }, isContainer: true, children: [] },
        { type: 'Delay', category: 'control', params: { seconds: 1 } }
      ]
    }
  };

  return (
    <div className="w-72 bg-white rounded-xl shadow-md p-4 h-[calc(100vh-180px)] overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
        <span className="mr-2">📦</span> Block Palette
      </h2>
      
      {!selectedCategory ? (
        <div className="space-y-3">
          {Object.entries(categories).map(([key, category]) => (
            <button
              key={key}
              className={`w-full p-4 text-left rounded-xl text-white shadow-md transition-all hover:shadow-lg flex items-center ${category.color}`}
              onClick={() => setSelectedCategory(key)}
            >
              <span className="text-2xl mr-3">{category.icon}</span>
              <span className="font-medium text-lg">{category.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            className="mb-4 text-blue-600 flex items-center hover:underline transition-all"
            onClick={() => setSelectedCategory(null)}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Categories
          </button>
          
          <h3 className="font-medium mb-3 flex items-center text-gray-700">
            <span className="mr-2">{categories[selectedCategory].icon}</span>
            {categories[selectedCategory].name}
          </h3>
          
          <div>
            {categories[selectedCategory].blocks.map((block, i) => (
              <Block 
                key={i} 
                block={block} 
                color={categories[selectedCategory].color} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockPalette;