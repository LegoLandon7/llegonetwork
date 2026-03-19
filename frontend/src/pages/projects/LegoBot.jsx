import InfoBlock from '../../components/universal/InfoBlock.jsx'

import '../../components/css/containers.css'

function LegoBot() {
  return <div className="main-content">
        <div className="flex-container-wrap">
            <InfoBlock 
                header={"LegoBot"}
                headerPos={"left"}
                imgPos={"left"}
                img={"https://cuddly-succotash-7vjr9r6g9q5vfx676-5173.app.github.dev/favicon.png"}
                description={"LegoBot is a muilti-purpose discord bot that allows you to do almost anything any ordinary bot would do. This bot can handle moderation, logging, quality of life commands, and so much more!\n\nThis is the info page."}
                buttons={[
                    {label: "Back", to: "/projects"},
                    {label: "Invite", to: "/"},
                    {label: "Repo", to: "/"}
                ]}
            />
        </div>
    </div>
}

export default LegoBot