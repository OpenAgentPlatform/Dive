class AppState {
  public isQuitting = true

  public setIsQuitting(isQuitting: boolean) {
    this.isQuitting = isQuitting
  }
}

export default new AppState()
