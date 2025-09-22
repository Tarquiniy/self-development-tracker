document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if(!confirm('Вы уверены?')) e.preventDefault();
        });
    });
});
