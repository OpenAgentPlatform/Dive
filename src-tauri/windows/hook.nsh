!macro NSIS_HOOK_POSTUNINSTALL
    ${GetEnv} "USERPROFILE" $0
    StrCpy $1 "$0\.dive"
    RMDir /r "$1"
!macroend