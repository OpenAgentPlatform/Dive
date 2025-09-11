import PageLayout from "./Layout"
import ModelsProvider from "./ModelsProvider"
import "../../../styles/overlay/_Model.scss"

const Models = () => {
  return (
    <ModelsProvider>
      <PageLayout />
    </ModelsProvider>
  )
}

export default Models