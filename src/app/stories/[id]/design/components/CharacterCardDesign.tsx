'use client'
import { useState } from 'react'
import { Users } from 'lucide-react'

function CharacterCardDesign(char: any) {
    const [openCharacterEditor, setOpenCharacterEditor] = useState(false)
    const [input, setInput] = useState(char.char.descsription)

    const editCharacter = () => {
        setOpenCharacterEditor(true)
      }
console.log(char.char.descsription)
const character = char.char
  return (
    <div key={character.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
    <div className="w-16 h-16 bg-black/40 rounded-lg shrink-0 flex items-center justify-center border border-white/5">
        <Users className="w-6 h-6 text-white/20" />
    </div>
    <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start">
            <h3 className="font-bold text-white">{character.name}</h3>
            <button
                onClick={editCharacter}
                className="text-xs text-amber-500 hover:text-amber-400"
                >
                    Edit
            </button>
        </div>
        {openCharacterEditor ? (
    <div className="relative">
    <textarea
      placeholder={char.description ?? "Describe this character…"}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      rows={1}
      className="
        w-full resize-none
        rounded-xl
        bg-[#0F1115]
        text-slate-100
        placeholder:text-slate-400
        border border-white/10
        px-4 py-3
        text-sm leading-relaxed
        shadow-inner
        transition
        focus:outline-none
        focus:border-amber-400/60
        focus:ring-2 focus:ring-amber-400/20
      "
      style={{
        minHeight: "44px",
        maxHeight: "120px",
      }}
    />

    {/* subtle glow layer */}
    <div className="
      pointer-events-none absolute inset-0
      rounded-xl
      ring-1 ring-white/5
    " />
  </div>
     
        ):
        <p className="text-xs text-white/50 line-clamp-2 mt-1">{character.description}</p>
}
    </div>
</div>
  )
}

export default CharacterCardDesign
