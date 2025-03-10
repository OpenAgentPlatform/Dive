import PageLayout from "./Layout"
import ModelsProvider from "./ModelsProvider"


const Models = () => {
  return (
    <ModelsProvider>
      <PageLayout />
    </ModelsProvider>
  )
}

export default Models