import { useState, useEffect } from 'react';
import { 
  Waves, Settings2, User, Wand2, Clock, Images, 
  Folder, Puzzle, CheckCircle2, Image as ImageIcon, 
  Type, Sparkles, ChevronDown, AlertCircle
} from 'lucide-react';

function App() {
  const [prompt, setPrompt] = useState('Transform this image into a beautiful Scandinavian vintage illustration. Preserve the original composition, use bold outlines and warm muted colors.');
  const [status, setStatus] = useState('Waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('i2i'); // 'i2i' or 't2i'
  const [activeNav, setActiveNav] = useState('AI Studio');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'EXTENSION_RESPONSE') {
        console.log("App received response from extension:", event.data.payload);
        setStatus(event.data.payload.status || 'Done');
        if (event.data.payload.status === 'error') {
            const actualMsg = event.data.payload.message || event.data.payload.detail?.message || "An unknown error occurred.";
            setErrorMessage(actualMsg);
        } else {
            setErrorMessage('');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleUseExample = () => {
    setPrompt("A breathtaking, high-resolution architectural photography shot of the White House in Washington D.C. during the golden hour. The building is elegantly illuminated by warm, soft evening sunlight, casting long shadows across the pristine green lawn. Cinematic lighting, ultra-detailed, 8k resolution, photorealistic, masterpiece.");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
        {/* Left Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Waves size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">FlowBridge</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">AI Image Studio</p>
          </div>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-xs font-medium text-orange-600">Flow offline</span>
          </div>
          <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
            <Settings2 size={18} />
          </button>
          <button className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
            <User size={18} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
          <div className="p-4 flex-1">
            <nav className="space-y-1">
              {['AI Studio', 'History', 'My Gallery'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => setActiveNav(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeNav === item ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {item === 'AI Studio' && <Wand2 size={18} />}
                    {item === 'History' && <Clock size={18} />}
                    {item === 'My Gallery' && <Images size={18} />}
                    {item}
                  </button>
              ))}
            </nav>
            
            <div className="mt-8">
              <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Workspace</p>
              <nav className="space-y-1">
                 {['My Projects', 'Flow Extension'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => setActiveNav(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeNav === item ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {item === 'My Projects' && <Folder size={18} />}
                    {item === 'Flow Extension' && <Puzzle size={18} />}
                    {item}
                  </button>
                ))}
              </nav>
            </div>
          </div>
          
          {/* Footer Info Box */}
          <div className="p-4">
            <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 size={16} />
                <span className="text-xs font-semibold">Local-first</span>
              </div>
              <p className="text-xs text-gray-500 leading-snug">
                Your Flow account stays in your browser.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-white m-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{activeNav}</h2>
                <p className="text-gray-500 text-sm mt-1">Create and transform images using natural language.</p>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full border border-gray-200">
                Prototype
              </span>
            </div>

            {activeNav !== 'AI Studio' ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Images size={32} />
                    </div>
                    <p className="font-medium text-gray-600 mb-2">This module is under construction</p>
                    <p className="text-sm text-gray-400">Please switch back to AI Studio to continue testing</p>
                </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button 
                    onClick={() => setActiveTab('i2i')}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-colors ${activeTab === 'i2i' ? 'border-blue-400 bg-blue-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'}`}
                  >
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <ImageIcon size={18} className={activeTab === 'i2i' ? "text-blue-600" : "text-gray-500"} />
                      Image to Image
                    </div>
                    <span className="text-xs text-gray-500">Edit existing photos</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('t2i')}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-colors ${activeTab === 't2i' ? 'border-blue-400 bg-blue-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'}`}
                  >
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <Type size={18} className={activeTab === 't2i' ? "text-blue-600" : "text-gray-500"} />
                      Text to Image
                    </div>
                    <span className="text-xs text-gray-500">Create from prompts</span>
                  </button>
                </div>

                {/* Form and Preview Grid */}
                <div className="grid grid-cols-5 gap-8">
                  {/* Left Column (Form) */}
                  <div className="col-span-3 space-y-6">
                    
                    {/* Reference Image */}
                    {activeTab === 'i2i' && (
                        <div>
                        <h3 className="text-[15px] font-semibold text-gray-800 mb-3">Reference Image</h3>
                        <div className="border border-dashed border-blue-200 rounded-xl p-4 flex flex-col items-center cursor-pointer hover:bg-blue-50/50 transition-colors">
                            <div className="w-full h-40 bg-[#F3D7D1] rounded-lg shadow-inner flex items-center justify-center mb-3 overflow-hidden relative">
                            <div className="w-24 h-28 bg-[#A21B2A] absolute bottom-4 rounded-[50%_50%_50%_50%/70%_70%_30%_30%] shadow-lg flex flex-col items-center">
                                <div className="w-2 h-8 bg-[#811320] absolute -top-8 rounded-t-sm"></div>
                                <div className="w-1 h-20 bg-white/20 absolute left-4 top-4 rounded-full blur-[1px] transform -rotate-12"></div>
                            </div>
                            </div>
                            <button className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-2">
                            Change demo image
                            </button>
                        </div>
                        </div>
                    )}

                    {/* Prompt */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[15px] font-semibold text-gray-800">Your Prompt</h3>
                        <Sparkles size={16} className="text-blue-500" />
                      </div>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe what you want to see..."
                        className="w-full h-28 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-[15px] leading-relaxed"
                      />
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-gray-400 font-medium">{prompt.length} characters</span>
                        <button onClick={handleUseExample} className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors active:bg-gray-100">
                          Use Example
                        </button>
                      </div>
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">AI Model</label>
                        <div className="relative">
                          <select className="w-full appearance-none bg-white border border-gray-200 rounded-full px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium cursor-pointer hover:border-gray-300 transition-colors">
                            <option>Nano Banana</option>
                            <option>Veo 3.1</option>
                            <option>Imagen 4</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-2.5 text-gray-400 pointer-events-none" size={16} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Aspect Ratio</label>
                        <div className="relative">
                          <select className="w-full appearance-none bg-white border border-gray-200 rounded-full px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium cursor-pointer hover:border-gray-300 transition-colors">
                            <option>1:1</option>
                            <option>16:9</option>
                            <option>9:16</option>
                            <option>4:3</option>
                            <option>3:4</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-2.5 text-gray-400 pointer-events-none" size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <div className="pt-2">
                      <button 
                        onClick={() => {
                          setStatus("Connecting...");
                          setErrorMessage('');
                          console.log("Sending generate message to extension...");
                          window.postMessage({ type: "GENERATE_IMAGE", payload: { prompt } }, "*");
                        }}
                        className="w-full py-3 bg-[#0F1115] hover:bg-black text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"
                      >
                        <Wand2 size={18} className="text-white/80" />
                        Preview Generate
                      </button>
                      <p className="text-[11px] text-blue-400 text-center mt-3 font-medium">
                        This will send the prompt to the Flow Bridge extension.
                      </p>
                    </div>

                  </div>

                  {/* Right Column (Preview) */}
                  <div className="col-span-2">
                    <div className="h-full border border-gray-100 bg-[#F9FAFB] rounded-2xl p-5 flex flex-col relative overflow-hidden">
                      <div className="flex justify-between items-center mb-4 z-10">
                        <h3 className="text-[15px] font-semibold text-gray-800">Result Preview</h3>
                        <span className={`px-3 py-1 bg-white border text-xs font-semibold rounded-full shadow-sm capitalize ${status === 'error' ? 'border-red-200 text-red-600' : status === 'processing' ? 'border-blue-200 text-blue-600' : 'border-gray-200 text-gray-800'}`}>
                          {status}
                        </span>
                      </div>
                      
                      {status === 'error' && errorMessage && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 z-10 animate-in fade-in slide-in-from-top-2">
                              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-red-700 leading-relaxed font-medium">{errorMessage}</p>
                          </div>
                      )}

                      <div className="flex-1 flex flex-col items-center justify-center text-center bg-white/50 rounded-xl border border-dashed border-gray-200 mt-2 z-10 transition-colors hover:bg-white/80">
                        <div className="w-16 h-16 bg-white border border-gray-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                          {status === 'processing' || status === 'Connecting...' ? (
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          ) : status === 'error' ? (
                             <AlertCircle size={32} className="text-red-300" />
                          ) : (
                             <ImageIcon size={32} className="text-gray-300" />
                          )}
                        </div>
                        <h4 className="text-gray-700 font-medium mb-1">
                            {status === 'processing' || status === 'Connecting...' ? 'Generating...' : status === 'error' ? 'Connection Failed' : 'Your image will appear here'}
                        </h4>
                        <p className="text-sm text-gray-400 max-w-[200px] leading-relaxed">
                          {status === 'processing' || status === 'Connecting...' ? 'The extension is automating Google Flow in another tab.' : 'Set up your request and preview the workflow.'}
                        </p>
                      </div>
                      
                      {/* Decorative background element when processing */}
                      {(status === 'processing' || status === 'Connecting...') && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
                      )}
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
